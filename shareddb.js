// shared/db.js - 共享数据库模块
const DB_NAME = 'JudgeSurveyDB';
const DB_VERSION = 1;
const STORE_NAME = 'responses';

let db = null;

// 初始化数据库
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                // 创建索引用于快速查询
                store.createIndex('userId', 'userId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('q1Choice', 'q1Choice', { unique: false });
            }
        };
    });
}

// 添加测评数据 (H5调用)
async function saveSurvey(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // 自动生成用户ID和时间
        const record = {
            ...data,
            userId: data.userId || 'USER_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        };
        
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 获取所有数据 (看板调用)
async function getAllSurveys() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 获取今日数据
async function getTodaySurveys() {
    const all = await getAllSurveys();
    const today = new Date().toISOString().split('T')[0];
    return all.filter(d => d.date === today);
}

// 获取统计信息
async function getStats() {
    const all = await getAllSurveys();
    const today = new Date().toISOString().split('T')[0];
    
    return {
        total: all.length,
        today: all.filter(d => d.date === today).length,
        avgDuration: all.length > 0 
            ? Math.round(all.reduce((sum, d) => sum + (d.duration || 0), 0) / all.length)
            : 0,
        completionRate: all.length > 0
            ? Math.round(all.filter(d => d.q4Choice).length / all.length * 100)
            : 0
    };
}

// 监听数据变化（看板实时更新）
function onDataChange(callback) {
    // 使用 BroadcastChannel 实现跨页面通信
    if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('survey_updates');
        channel.onmessage = (event) => {
            if (event.data.type === 'NEW_SURVEY') {
                callback(event.data.data);
            }
        };
        return channel;
    }
    return null;
}

// 通知其他页面数据已更新（H5提交后调用）
function notifyDataUpdate(data) {
    if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('survey_updates');
        channel.postMessage({ type: 'NEW_SURVEY', data });
    }
}

// 导出模块（如果是ES6模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initDB, saveSurvey, getAllSurveys, getTodaySurveys, 
        getStats, onDataChange, notifyDataUpdate
    };
}