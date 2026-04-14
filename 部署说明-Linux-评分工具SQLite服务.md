# Linux 部署说明：评分工具 + SQLite 服务

## 1. 需要上传的文件
把下面这些文件一起上传到 Linux 服务器同一个目录：

- `评分录入页.html`
- `评分管理后台.html`
- `评分工具样式.css`
- `评分工具脚本.js`
- `评分工具接口配置.js`
- `评分工具SQLite服务.py`

## 2. 检查 Python 3
先确认服务器已经安装 Python 3：

```bash
python3 --version
```

如果没有：

```bash
sudo apt update
sudo apt install -y python3
```

## 3. 启动 SQLite 服务
进入上传目录后执行：

```bash
python3 评分工具SQLite服务.py
```

默认监听地址：

```text
http://0.0.0.0:8765
```

默认会自动创建数据库文件：

```text
survey_data.sqlite3
```

## 4. 配置前端 API 地址
编辑 `评分工具接口配置.js`：

```js
window.SURVEY_API_BASE = "http://你的服务器IP:8765";
window.SURVEY_API_TOKEN = "";
```

如果你有域名，也可以写成：

```js
window.SURVEY_API_BASE = "https://your-domain.com";
```

## 5. 页面访问方式
需要把这些前端文件放到 Web 服务目录里，不能直接通过 `file://` 打开。

例如安装 Nginx：

```bash
sudo apt install -y nginx
```

把文件放到：

```text
/var/www/html/
```

然后访问：

- `http://你的服务器IP/评分录入页.html`
- `http://你的服务器IP/评分管理后台.html`

## 6. 可选：开启 API Token
如果不想让别人随便提交数据，可以设置环境变量：

```bash
export SURVEY_API_TOKEN="你的密钥"
python3 评分工具SQLite服务.py
```

然后把 `评分工具接口配置.js` 里的：

```js
window.SURVEY_API_TOKEN = "你的密钥";
```

## 7. systemd 后台运行
创建：

```text
/etc/systemd/system/review-sqlite.service
```

内容：

```ini
[Unit]
Description=Review SQLite API Service
After=network.target

[Service]
WorkingDirectory=/你的项目目录
ExecStart=/usr/bin/python3 /你的项目目录/评分工具SQLite服务.py
Restart=always
User=root
Environment=SURVEY_PORT=8765

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable review-sqlite
sudo systemctl start review-sqlite
sudo systemctl status review-sqlite
```

## 8. 验证接口
健康检查：

```bash
curl http://127.0.0.1:8765/api/health
```

查看评分记录：

```bash
curl http://127.0.0.1:8765/api/reviews
```

## 9. 这套工具包含什么
- `评分录入页.html`：给审核人员填写评分
- `评分管理后台.html`：查看记录、筛选、导出
- `评分工具样式.css`：页面样式
- `评分工具脚本.js`：前端交互逻辑
- `评分工具接口配置.js`：前端 API 地址配置
- `评分工具SQLite服务.py`：后端接口和 SQLite 存储服务
