<p align="center">
  <img src="docs/assets/rowport-logo.svg" alt="RowPort" width="520">
</p>

# RowPort

[![CI](https://github.com/gloopai/rowport/actions/workflows/ci.yml/badge.svg)](https://github.com/gloopai/rowport/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md)

RowPort 是一个使用 Wails、Go 和 Vue 构建的快速、克制的桌面 MySQL 客户端。它聚焦日常数据库工作流：连接服务器、浏览 schema、编辑表数据、导入导出数据，以及在一个轻量的原生应用里运行 SQL。

RowPort 的目标是提供接近 DataGrip 这类桌面工具的现代体验，同时保持小巧、原生、容易理解和维护。

## 为什么做 RowPort？

- 原生桌面 shell，配合聚焦的 Vue 界面。
- 面向真实 MySQL 工作流：表浏览、行编辑、SQL 执行、CSV 导入、CSV/JSON 导出。
- 支持多个已保存服务器配置和可选 SSH 隧道。
- 记住的数据库和 SSH 密钥存储在 macOS Keychain 中，不写入 local storage。
- 暗色桌面 UI，面向高频数据库操作，而不是浏览器式后台面板。

## 功能

- 使用 host、port、user、password 以及可选的默认数据库连接 MySQL。
- 保存并切换多个服务器配置。
- 通过 SSH 隧道连接，支持密码认证、私钥文本和私钥路径，并校验主机密钥（known_hosts + 按配置的信任首次使用）；对未信任或已变更的密钥会弹出交互式指纹确认对话框。
- 使用 SSL/TLS 加密 MySQL 连接（preferred、required、verify-ca、verify-identity），可选 CA、客户端证书和 server name。
- 将记住的 MySQL 密码、SSH 密码和 SSH 私钥 passphrase 存入 macOS Keychain。
- 浏览数据库、表、列、索引、主键和表 DDL。
- 打开表数据，支持分页、过滤、排序、CSV 导入、CSV/JSON 导出，以及复制当前可见行。
- 对带主键的表执行插入、编辑和删除行操作。
- 在选中的数据库上运行 SQL，并在可滚动表格中查看结果集。
- 保留多个结果 tab，并查看结果行详情。
- 导出应用日志，方便调试和提交 issue。
- 按配置调整连接池设置。
- 打开 `.sql` 文件，并生成常用的 SELECT、INSERT、UPDATE、DELETE 和 DDL 模板。

## 状态

RowPort 还处于 early preview / pre-release 阶段，但已经可用。核心连接、schema 浏览、表数据、行变更、SQL 控制台、查询取消、配置管理、SSH 隧道、MySQL SSL/TLS、SSH host key verification、导入导出和日志工作流已经实现。

打包、发布自动化、跨平台凭据存储，以及更丰富的结果处理工具仍在计划中。

## 平台支持

| 平台 | 当前状态 | 说明 |
| --- | --- | --- |
| macOS | 主要开发目标 | 已实现 Keychain 凭据存储。 |
| Windows | 计划支持 | 可以通过 Wails 构建，但凭据持久化和发布打包还需要补齐。 |
| Linux | 计划支持 | 可以通过 Wails 构建，但 Secret Service 支持和发布打包还需要补齐。 |

## 下载

预构建 GitHub Releases 会在第一个公开版本中提供。当前可以先通过下面的开发或构建命令从源码运行。

## 技术栈

- Wails v2：桌面 shell 和 Go 到前端的绑定。
- Go：MySQL 连接、SSH 隧道、Keychain 集成和文件系统对话框。
- Vue 3 和 Vite：前端。
- `go-sql-driver/mysql`：数据库访问。
- `golang.org/x/crypto/ssh`：SSH 隧道支持。

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
- Node.js 20 或更新版本，以及 npm。
- Wails CLI v2。
- 一个可访问的 MySQL server，用于手动测试。
- macOS 用于 Keychain 凭据存储。其他平台也可以运行应用，但凭据持久化还需要对应平台的实现工作。

## 开发

安装前端依赖：

```sh
cd frontend
npm ci
```

启动 Wails 开发模式：

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails dev -compiler "$PWD/scripts/go-wails"
```

## 构建

完整的构建与发布指南（含 Wails 包装脚本的原因和发布检查清单）见 [docs/RELEASE.md](docs/RELEASE.md)。

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

- 添加 known_hosts 管理界面，用于查看和撤销已信任的主机密钥。
- 添加更丰富的查询历史、已保存片段和结果工具。
- 添加已保存片段和更多结果导出工具。
- 添加 macOS 和 Windows 发布构建。
- 第一个公开版本前补充截图和简短演示 GIF。

## 贡献

欢迎提交 issue 和 pull request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，保持变更聚焦，附上验证说明，并避免在平台凭据存储之外持久化任何密钥。

当前产品计划和 TODO 见 [docs/PROJECT_PLAN.zh-CN.md](docs/PROJECT_PLAN.zh-CN.md)。
