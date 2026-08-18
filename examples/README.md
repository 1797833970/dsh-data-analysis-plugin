# 运行示例

安装 Python 环境和 profile 后启动：

```sh
dsh --profile data-analysis
```

打开 `http://127.0.0.1:3080`，输入一个完整绝对路径并让智能体全自动分析：

> 帮我全自动分析 `/absolute/path/to/sales.csv`

预期会话工作目录出现 `loaded.parquet` 和 `clean.parquet`，页面显示分析进度、图表和报告。
