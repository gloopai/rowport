<p align="center">
  <img src="docs/assets/rowport-logo.svg" alt="RowPort" width="520">
</p>

# RowPort

[English](README.md)

RowPort 是一个使用 Wails、Go 和 Vue 构建的桌面 MySQL 客户端。它聚焦日常数据库工作流：连接服务器、浏览 schema、编辑表数据，以及在一个轻量的原生应用里运行 SQL。

项目还处于早期阶段，但已经可用。它正在为开源发布做准备，因此当前重点是提供干净的本地开发体验、清晰的安全边界，以及一个小而稳定、后续可扩展的核心功能集，而不是做成笨重的数据库 IDE。

## 功能

- 使用 host、port、user、password 以及可选的默认数据库连接 MySQL。
- 保存并切换多个服务器配置。
- 通过 SSH 隧道连接，支持密码认证、私钥文本和私钥路径。
- 将记住的 MySQL 密码、SSH 密码和 SSH 私钥 passphrase 存入 macOS Keychain。
- 浏览数据库、表、列、索引、主键和表 DDL。
- 打开表数据，支持分页、过滤、排序、CSV/JSON 导出，以及复制当前可见行。
- 对带主键的表执行插入、编辑和删除行操作。
- 在选中的数据库上运行 SQL，并在可滚动表格中查看结果集。
- 打开 `.sql` 文件，并生成常用的 SELECT、INSERT、UPDATE、DELETE 和 DDL 模板。

## 技术栈

- Wails v2：桌面 shell 和 Go 到前端的绑定。
- Go：MySQL 连接、SSH 隧道、Keychain 集成和文件系统对话框。
- Vue 3 和 Vite：前端。
- `go-sql-driver/mysql`：数据库访问。
- `golang.org/x/crypto/ssh`：SSH 隧道支持。

## 项目状态

RowPort 正在积极开发中。核心连接、schema 浏览、表数据、行变更、SQL 控制台、配置管理和 SSH 隧道工作流已经实现。打包、发布自动化、跨平台体验优化、SSL/TLS 选项、查询取消，以及更丰富的结果处理工具仍在计划中。

## 仓库结构

```text
.
├── app.go                  # 暴露给前端的 Go 后端方法
├── main.go                 # Wails 应用入口
├── frontend/               # Vue/Vite 前端
├── build/                  # Wails 构建资源和平台元数据
├── docs/assets/            # 项目 logo 和品牌资源
└── scripts/go-wails        # 本地 Wails 编译器包装脚本
```

## 环境要求

- Go 1.24 或更新版本。
- Node.js 和 npm。
- Wails CLI v2。
- 一个可访问的 MySQL server，用于手动测试。
- macOS 用于 Keychain 凭据存储。其他平台也可以运行应用，但凭据持久化还需要对应平台的实现工作。

## 开发

安装前端依赖：

```sh
cd frontend
npm install
```

启动 Wails 开发模式：

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails dev -compiler "$PWD/scripts/go-wails"
```

## 构建

当前 Wails 版本在本项目使用的本地 macOS SDK 下需要链接 `UniformTypeIdentifiers`，因此请使用包装脚本：

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails build -compiler "$PWD/scripts/go-wails"
```

如果 Wails 报告通用编译错误，可以用下面的直接命令验证生产可执行文件：

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
"$PWD/scripts/go-wails" build \
  -buildvcs=false \
  -tags desktop,wv2runtime.download,production \
  -ldflags "-w -s" \
  -o "$PWD/build/bin/rowport"
```

## 验证

运行前端构建：

```sh
cd frontend
npm run build
```

运行 Go 测试：

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
go test ./...
```

## 安全说明

- 粘贴的 SSH 私钥文本只作为一次性输入处理，不会持久化。
- 记住的 MySQL 密码、SSH 密码和 SSH 私钥 passphrase 会存储在 macOS Keychain 中。
- 保存配置时，如果关闭某个记住选项，对应密钥会从 Keychain 中删除。
- 删除配置会移除该配置下所有已记住的密钥。
- 非密钥类配置字段会存储在浏览器 local storage 中。

## 路线图

- 添加 SSL/TLS 选项和 host key verification。
- 添加查询取消和更丰富的查询历史。
- 添加已保存片段和更多结果导出工具。
- 改进打包元数据和发布构建。
- 发布前补充截图、贡献指南和正式 license。

## 贡献

仓库发布后，欢迎提交 issue 和 pull request。请保持变更聚焦，附上验证说明，并避免在平台凭据存储之外持久化任何密钥。
