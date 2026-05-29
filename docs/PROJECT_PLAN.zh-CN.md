# RowPort 项目计划与产品 TODO

本文档用于两个目的：

1. 作为后续产品开发、技术取舍和优先级排序的参考。
2. 作为开源仓库中给贡献者、使用者和潜在维护者阅读的项目计划。

本文档基于当前仓库代码和文档调研整理，重点参考：

- `README.md` / `README.zh-CN.md` 中声明的项目定位、功能、技术栈和路线图。
- `app.go` 中已经实现的 MySQL 连接、SSH 隧道、Keychain 凭据管理、schema 查询、表数据读写和 SQL 执行能力。
- `frontend/src/App.vue` 中已经实现的连接管理、数据库树、表格数据、SQL 控制台、结果导出、CSV 导入、操作日志和基础 IDE 式交互。
- `go.mod`、`wails.json`、`frontend/package.json` 中体现的工程栈、构建方式和依赖边界。

## 1. 项目目的

RowPort 的核心目标是做一个快而克制、轻量、清晰、可信任的桌面 MySQL 客户端，覆盖开发者和小团队最频繁的数据库日常操作：

- 快速连接本地、内网或跳板机后的 MySQL。
- 浏览数据库、表、字段、索引和 DDL。
- 查看、筛选、排序、复制、导出和编辑表数据。
- 运行临时 SQL，查看结果，并保留基础历史记录。
- 在本地桌面环境中安全地处理数据库密码和 SSH 凭据。

RowPort 不追求一开始就成为 DataGrip、DBeaver 或 Navicat 这类大型数据库 IDE 的替代品。更合理的定位是：

- 比命令行 MySQL 更直观。
- 比重型 IDE 更轻、更容易启动、更少配置。
- 比 Web 管理工具更适合本地凭据和 SSH 隧道场景。
- 优先服务 MySQL，而不是一开始扩展到所有数据库。

一句话定位：

> RowPort 是一个开源、快速、克制、以 MySQL 日常操作为中心的本地桌面数据库客户端。

## 2. 目标用户

### 2.1 主要用户

- 后端工程师：需要连接开发、测试、预发数据库，查数据、改少量数据、验证 SQL。
- 全栈工程师：需要在开发应用时快速检查表结构和数据状态。
- 独立开发者：需要一个不复杂、不订阅、不绑定云服务的 MySQL 桌面客户端。
- 小团队维护者：需要通过 SSH 隧道访问内网 MySQL，并希望凭据存储在本机系统凭据工具中。

### 2.2 次要用户

- 数据分析轻量用户：偶尔运行 SELECT、导出 CSV/JSON。
- 开源贡献者：希望在清晰边界下修复 bug、补功能、改 UI。
- 学习 MySQL 的用户：需要图形化浏览表结构和执行基础 SQL。

### 2.3 暂不优先的用户

- 企业级 DBA：需要高级审计、权限管理、复杂备份恢复、集群拓扑、慢查询平台等能力。
- 重度数据分析用户：需要图表、Notebook、复杂数据建模或跨库分析。
- 多数据库用户：当前项目优先 MySQL，不应过早扩展 PostgreSQL、SQLite、SQL Server 等数据库。

## 3. 产品原则

### 3.1 轻量优先

RowPort 应保持启动快、界面直接、依赖少。新增功能必须围绕常用数据库工作流，避免堆叠低频复杂能力。

### 3.2 性能优先

RowPort 的差异化不来自功能数量，而来自日常操作的速度和稳定性。启动、schema 展开、表格渲染、查询结果展示、CSV 导入导出都应该有性能意识。面对大库、大表、多字段、多结果集时，默认策略应该是 lazy load、分页、虚拟化、分批处理和明确进度。

### 3.3 本地可信

数据库连接和凭据属于敏感信息。产品应尽量保持本地运行、本地存储、本机系统凭据管理，不引入远程账号体系或外部同步服务作为核心依赖。

### 3.4 MySQL 优先

短期内所有体验都应围绕 MySQL 打磨，包括 MySQL 的 schema、DDL、字符集、时间类型、JSON、索引、EXPLAIN 和连接选项。多数据库支持可以作为长期方向，但不应稀释当前核心质量。

### 3.5 数据变更要克制

表数据编辑、DELETE、UPDATE、导入等能力必须有明确确认、影响范围提示和可恢复思路。默认交互应该减少误操作，而不是鼓励用户直接大范围写库。

### 3.6 开源友好

项目计划、路线图、贡献入口、开发命令、验收标准和安全边界都应该写清楚。贡献者应该能知道什么值得做、怎么验证、哪些方向暂时不接。

## 4. 当前状态评估

### 4.1 已实现能力

连接与配置：

- 支持多个连接 profile。
- 支持 host、port、user、password、默认 database。
- 支持连接测试。
- 支持高级连接参数：连接超时、最大连接数、最大空闲连接数。
- 支持本地 profile 存储，非密钥字段放在浏览器 local storage。

SSH 与凭据：

- 支持 SSH 隧道。
- 支持 SSH 密码。
- 支持 SSH 私钥文本。
- 支持 SSH 私钥路径。
- 支持 SSH 私钥 passphrase。
- 支持 MySQL 密码、SSH 密码、SSH passphrase 存入 macOS Keychain。
- 粘贴的 SSH 私钥文本不持久化。

schema 浏览：

- 支持 `SHOW DATABASES`。
- 支持从 `information_schema.tables` 读取表列表、类型、行数估计和 engine。
- 支持从 `information_schema.columns` 读取列信息。
- 支持从 `information_schema.statistics` 读取索引信息。
- 支持 `SHOW CREATE TABLE` 查看 DDL。

表数据：

- 支持分页读取表数据。
- 支持 page size 选择。
- 支持 where 条件过滤。
- 支持按列排序。
- 支持读取 primary key 并基于 primary key 编辑/删除单行。
- 支持新增单行。
- 支持复制当前页、导出当前页 CSV/JSON。
- 支持 CSV 文件预览和按表头导入，单次限制 1000 行。
- 支持列宽拖拽。

SQL 控制台：

- 支持执行 SQL。
- 支持选中 SQL 或光标所在语句执行。
- 支持 `Cmd/Ctrl + Enter`。
- 支持 EXPLAIN。
- 支持打开 `.sql` 文件。
- 支持基础 SQL 格式化。
- 支持 SELECT、INSERT、UPDATE、DELETE 和 DDL 模板生成。
- 支持结果集 tab。
- SELECT 类查询结果限制 1000 行。
- 支持复制、导出查询结果 CSV/JSON。
- 对无 WHERE 的 UPDATE/DELETE 有前端确认保护。

界面与操作：

- 类 IDE 三栏布局：数据库树、编辑区、服务/日志区。
- 支持多 tab：SQL、表数据、结构视图。
- 支持操作日志、日志过滤、搜索、复制、导出。
- 支持浏览器预览模式下的 demo 数据。
- 支持面板尺寸调整并持久化。

### 4.2 当前主要限制

安全与连接：

- SSH host key verification 已实现：校验 `~/.ssh/known_hosts` 并对 profile 钉扎的密钥做信任首次使用；密钥变更会硬失败。连接前会预检主机密钥，未信任或已变更时弹出交互式指纹确认对话框。
- SSL/TLS 连接选项已实现：支持 disabled/preferred/required/verify-ca/verify-identity，以及 CA、客户端证书、server name 配置。
- 凭据持久化目前只针对 macOS Keychain；Windows Credential Manager 和 Linux Secret Service 尚未实现。
- profile 数据放在 local storage，缺少迁移机制、导入导出和版本化结构。

SQL 执行：

- 查询取消已经实现，但还缺少更细粒度的连接生命周期、断线检测和友好错误分类。
- 查询历史目前只在 local storage 中保存最近 30 条，缺少搜索、收藏、命名和跨 profile 归属。
- SQL 编辑器是 textarea 级别能力，缺少语法高亮、自动补全、错误定位、格式化质量和多结果集处理。
- 危险 SQL 判断是前端启发式保护，不应被视为强安全边界。
- 执行语句目前没有事务工作区、dry-run 或影响行数预览。

表数据：

- 单行编辑依赖 primary key；无 primary key 的表只能浏览，不能可靠编辑。
- CSV 解析是前端轻量实现，需要更严格处理编码、BOM、换行、分隔符、类型转换和大文件。
- 导出只覆盖当前页或当前结果，缺少全量导出、流式导出和进度反馈。
- where 条件支持原始文本，虽然有基础 token 拦截，但还不是结构化安全过滤。

工程质量：

- Go 后端已有纯函数单元测试（`app_test.go`），但仍缺少需要真实数据库的集成测试。
- 前端缺少组件拆分和测试体系，核心文件 `frontend/src/App.vue` 体量很大。
- 已有自动化 CI（frontend build + Go test）。
- 缺少正式 LICENSE、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、CHANGELOG。
- 缺少截图、发布说明、安装说明和 issue 模板。

平台与发布：

- 当前 README 明确 macOS 凭据体验最完整。
- Windows/Linux 打包、签名、公证、更新机制尚未成型。
- Wails 构建存在本地 wrapper 脚本依赖，需要解释清楚或逐步收敛。

## 5. 非目标

短期不做：

- 不做云端账号、同步、团队协作和远程项目空间。
- 不做完整 DBA 平台，例如备份恢复、权限审计、集群拓扑、监控告警。
- 不做所有数据库类型支持。
- 不做大型 BI、图表分析、Notebook 或数据管道。
- 不做内置 AI SQL 生成作为核心能力。
- 不默认绕过数据库本身权限系统；RowPort 只应使用用户提供的数据库账号权限。

这些方向可以在未来重新评估，但不应进入 v0.x 的核心路线。

## 6. 产品路线图

### 阶段 0：开源发布准备

目标：让陌生用户能理解项目、跑起来、知道怎么贡献，并且不会误解安全边界。

建议完成项：

- 补充正式 LICENSE。
- 补充 `CONTRIBUTING.md`。
- 补充 `SECURITY.md`，说明凭据存储、SSH/TLS 限制、漏洞报告方式。
- 补充 `CHANGELOG.md`。
- 补充 issue templates：bug、feature、security-sensitive question。
- README 增加截图或 GIF。
- README 增加安装/运行方式、常见问题、平台支持矩阵。
- 标注当前项目状态为 pre-release / early preview。
- 整理 release checklist。
- 明确项目定位：fast, restrained, local-first MySQL client。

验收标准：

- 新用户能在 10 分钟内完成依赖安装并启动开发模式。
- 贡献者能在文档里找到如何提交 bug、如何跑构建、如何跑测试。
- 文档明确说明当前 SSH host key verification 和 SSL/TLS 状态。

### 阶段 1：连接安全与基础可靠性

目标：把数据库客户端最关键的安全和稳定性补齐。

建议完成项：

- 支持 MySQL SSL/TLS 配置：
  - disabled / preferred / required / verify_ca / verify_identity。
  - CA 文件、client cert、client key。
  - server name 配置。
- 支持 SSH host key verification：
  - known_hosts 文件读取。
  - 首次连接指纹确认。
  - host key 变更告警。
- 支持连接 keepalive 和断线状态检测。
- 支持连接错误分类：
  - 网络不可达。
  - 认证失败。
  - TLS 配置错误。
  - SSH 隧道错误。
  - 数据库权限错误。
- 支持主动取消查询。
- 后端为连接、DSN、identifier quoting、where key 构造、CSV 导入等核心逻辑增加测试。
- 建立性能基线：启动耗时、schema 加载耗时、表格首屏渲染耗时、查询结果渲染耗时。

验收标准：

- 使用 TLS 的 MySQL 可以成功连接，并能显示当前 TLS 状态。
- SSH host key 不匹配时必须阻断连接并给出清楚提示。
- 用户可以取消长查询，UI 不会一直卡在 busy 状态。
- 核心 Go 测试能在 CI 里稳定运行。

### 阶段 2：SQL 工作区升级

目标：让 SQL 控制台从“能执行”变成“日常可用且舒服”。

建议完成项：

- 引入成熟 SQL 编辑器能力：
  - 语法高亮。
  - 行号和当前行。
  - 括号匹配。
  - 注释快捷键。
  - 缩进和格式化。
- 改进 SQL statement parser：
  - 更好处理字符串、注释、delimiter、存储过程。
  - 支持执行选区、当前语句、全部语句。
- 查询历史升级：
  - 按 profile / database 记录。
  - 搜索历史。
  - 收藏 SQL。
  - 给 SQL 片段命名。
- 支持多结果集或至少明确处理多语句结果。
- 支持结果元信息：
  - 执行时间。
  - rows affected。
  - truncated 状态。
  - 查询开始/结束时间。
- EXPLAIN 结果增强：
  - EXPLAIN FORMAT=JSON。
  - 高风险提示，例如 full table scan。

验收标准：

- 用户可以在一个 SQL tab 内高效编辑、执行、查历史。
- 执行长 SQL 和多语句时行为可预期。
- 查询历史不会混淆不同连接和数据库。

### 阶段 3：表数据体验打磨

目标：把“查看和小规模修改表数据”做成 RowPort 的核心优势。

建议完成项：

- 结构化过滤器升级：
  - 多条件 AND/OR。
  - 括号分组。
  - 字段类型感知输入。
  - 生成参数化查询或后端安全表达。
- 单元格体验：
  - 双击编辑。
  - long text / JSON 专用查看器。
  - NULL、空字符串、二进制值视觉区分。
  - 时间类型格式化。
- 变更预览：
  - 插入/更新/删除前展示将执行的 SQL。
  - 显示 primary key 和影响行数预期。
- 支持批量选择与批量删除，但默认要强确认。
- 无 primary key 表的策略：
  - 默认只读。
  - 提示原因。
  - 可选使用唯一索引编辑。
- 表格性能：
  - 大列数横向滚动优化。
  - 大文本延迟渲染。
  - 保持列宽、排序、过滤偏好。

验收标准：

- 用户可以放心编辑单行数据，并清楚知道会改哪一行。
- 无 primary key 表不会给出误导性的编辑入口。
- 大表分页、排序、过滤时 UI 状态稳定。

### 阶段 4：schema 与 DDL 工具

目标：让 schema 浏览和常用 DDL 修改更直观，但仍保持谨慎。

建议完成项：

- 表结构视图增加：
  - 列详情面板。
  - 索引分组展示。
  - 外键展示。
  - 触发器和视图信息。
- DDL 模板升级：
  - 添加列。
  - 修改列。
  - 删除列。
  - 创建/删除索引。
  - rename table。
  - drop table。
- DDL 执行前确认：
  - 高风险操作明确标红。
  - 展示目标 database/table。
  - 建议复制 SQL 后手动执行，而不是隐藏执行。
- schema diff 暂不作为早期目标，可以先提供复制 DDL 和模板。

验收标准：

- 用户可以快速理解一个表的字段、主键、索引和 DDL。
- 高风险 DDL 不会被误触发。

### 阶段 5：导入导出与本地文件工作流

目标：让 RowPort 适合常见数据搬运，但不变成 ETL 工具。

建议完成项：

- CSV 导入增强：
  - 自动识别 UTF-8 BOM。
  - 分隔符选择：comma、tab、semicolon。
  - quote / escape 配置。
  - 空字符串与 NULL 映射。
  - 字段映射 UI。
  - 类型转换预览。
  - 错误行报告。
  - 分批导入和进度条。
- 导出增强：
  - 导出当前页。
  - 导出全部过滤结果。
  - 导出 SQL 查询结果。
  - CSV、JSON、NDJSON。
  - 大结果流式导出。
- SQL 文件：
  - 最近打开文件。
  - 保存当前 SQL 到文件。
  - 保存结果到指定路径。

验收标准：

- CSV 导入错误不会产生部分不可解释的数据状态。
- 大结果导出不会阻塞 UI 或耗尽内存。

### 阶段 6：跨平台与发布

目标：让项目能以开源桌面应用的形式稳定分发。

建议完成项：

- macOS：
  - app icon 完整化。
  - 签名和公证文档。
  - DMG 或 zip 发布。
- Windows：
  - Credential Manager 支持。
  - installer 元数据。
  - WebView2 依赖说明。
- Linux：
  - Secret Service/libsecret 支持。
  - AppImage 或 deb/rpm 方案评估。
- GitHub Actions：
  - frontend build。
  - Go test。
  - Wails build。
  - release artifact 上传。
- 发布版本规范：
  - semver。
  - changelog。
  - pre-release 标记。

验收标准：

- 每个 release 都有构建产物、变更说明和已知问题。
- 不同平台的凭据存储状态在文档里明确说明。

### 阶段 7：长期方向

这些方向需要在核心体验稳定后再评估：

- PostgreSQL 支持。
- SQLite 支持。
- 连接 profile 加密导入/导出。
- workspace/project 概念。
- 可选插件系统。
- ER 图或 schema graph。
- 查询收藏夹与 snippet library。
- 更高级的 explain 可视化。
- 数据库对象搜索。

## 7. 产品 TODO

优先级定义：

- P0：开源发布或基本安全可靠性必须完成。
- P1：核心产品体验，应尽快进入近期迭代。
- P2：增强体验，有价值但不阻塞早期发布。
- P3：长期方向或需要更多验证。

### 7.1 文档与开源治理

- [x] P0 添加正式 `LICENSE`。
- [x] P0 添加 `CONTRIBUTING.md`，包含开发环境、代码风格、提交 PR 和验证说明。
- [x] P0 添加 `SECURITY.md`，说明漏洞报告方式和当前安全边界。
- [x] P0 添加 `CHANGELOG.md`。
- [x] P0 添加 GitHub issue templates。
- [x] P0 在 README 中增加项目状态：early preview / pre-release。
- [x] P0 在 README 中增加平台支持矩阵。
- [x] P0 在 README 中明确 SSH host key verification 尚未完成。
- [x] P0 在 README 中明确 SSL/TLS 选项尚未完成。
- [x] P0 在 README 中明确 RowPort 的差异化定位：fast, restrained, local-first MySQL client。
- [ ] P1 添加截图或 GIF，展示连接、数据库树、表数据和 SQL 控制台。
- [ ] P1 添加 FAQ：连接失败、Keychain、SSH、Wails 编译问题。
- [x] P1 添加 release checklist。（见 docs/RELEASE.md）
- [ ] P2 添加架构文档，说明 Wails、Go 后端、Vue 前端和本地存储边界。

### 7.2 安全与凭据

- [x] P0 实现 SSH host key verification。（system known_hosts + per-profile TOFU 钉扎，密钥变更硬失败）
- [x] P0 在 SSH host key 未验证前，UI 明确提示风险。（ProfileDialog 展示已信任主机密钥并可重置；密钥变更时连接失败并提示可能的中间人攻击）
- [x] P0 实现 MySQL SSL/TLS 基础配置。（disabled/preferred/required/verify-ca/verify-identity + CA/客户端证书/server name）
- [x] P0 增加连接配置中的 TLS 状态展示。（连接状态栏显示 TLS/SSH 标记）
- [x] P1 增加 known_hosts 管理。（读取 ~/.ssh/known_hosts 校验，host key 变更硬失败）
- [x] P1 增加首次连接 host fingerprint 确认流程。（连接前 InspectSSHHostKey 预检，未信任/已变更时弹出指纹确认对话框，确认后钉扎到 profile）
- [ ] P1 增加 Keychain 读写错误的可见提示。
- [ ] P1 为 Windows Credential Manager 设计接口。
- [ ] P1 为 Linux Secret Service 设计接口。
- [ ] P1 增加 profile 导出时自动移除所有 secret 的保护。
- [ ] P2 支持加密导出 profile。
- [ ] P2 增加打开应用时清理孤儿 Keychain secret 的维护命令。

### 7.3 连接与后端稳定性

- [x] P0 增加主动查询取消。
- [x] P0 增加连接错误分类和用户友好错误消息。（classifyConnectionError：超时/拒绝/主机不存在/认证/权限/TLS/SSH）
- [x] P0 为 DSN 构造、identifier quoting、where key 构造增加 Go 单元测试。
- [x] P0 为 SSH auth method 选择增加测试。
- [ ] P1 增加连接 keepalive。
- [ ] P1 增加断线检测和重连入口。
- [ ] P1 增加连接池状态展示或调试信息。
- [x] P1 增加 schema 查询缓存失效策略。
- [ ] P1 支持刷新单个 database/table metadata。
- [ ] P2 支持连接分组。
- [ ] P2 支持 profile 搜索。
- [ ] P2 支持 profile 复制。

### 7.4 SQL 编辑器与查询工作流

- [ ] P1 引入语法高亮 SQL 编辑器。
- [ ] P1 改进 SQL 格式化。
- [x] P1 支持执行当前语句、选区、全部语句三种模式。
- [x] P1 查询历史按 profile/database 分组。
- [x] P1 查询历史支持搜索。
- [x] P1 支持收藏 SQL。
- [ ] P1 支持保存 snippet。
- [ ] P1 支持保存当前 SQL 到文件。
- [x] P1 支持查询取消按钮。
- [x] P1 操作日志显示实际执行的 SQL。
- [ ] P1 查询结果显示 truncated 状态和 limit 说明。
- [ ] P2 支持 EXPLAIN FORMAT=JSON。
- [ ] P2 EXPLAIN 风险提示：全表扫描、未使用索引、大 rows 估计。
- [ ] P2 支持多结果集展示。
- [ ] P2 支持 SQL autocomplete，至少包含 database/table/column。
- [ ] P3 支持 SQL lint。

### 7.5 表格数据体验

- [ ] P1 结构化过滤器支持多条件。
- [ ] P1 筛选条件改为类型感知输入。
- [ ] P1 更新/删除前展示将执行的 SQL 预览。
- [ ] P1 无 primary key 表明确展示只读原因。
- [ ] P1 支持使用唯一索引作为编辑键。
- [ ] P1 支持 long text / JSON 单元格详情视图。
- [ ] P1 NULL、空字符串、二进制值视觉区分。
- [ ] P1 表格列宽按 profile/database/table 持久化。
- [ ] P2 支持双击单元格编辑。
- [ ] P2 支持批量选择。
- [ ] P2 支持批量删除，必须强确认。
- [ ] P2 支持复制选中单元格范围。
- [ ] P2 支持隐藏/显示列。
- [ ] P2 支持按列快速过滤。

### 7.6 CSV 导入与导出

- [ ] P1 CSV 导入支持 UTF-8 BOM。
- [ ] P1 CSV 导入支持分隔符选择。
- [ ] P1 CSV 导入支持字段映射 UI。
- [ ] P1 CSV 导入支持 NULL 映射。
- [ ] P1 CSV 导入支持错误行报告。
- [ ] P1 CSV 导入支持分批导入和进度反馈。
- [ ] P1 导出支持全部过滤结果。
- [ ] P1 大结果导出改为流式或分批。
- [ ] P2 支持 TSV。
- [ ] P2 支持 NDJSON。
- [ ] P2 支持导出 schema DDL。
- [ ] P2 支持导入前 dry-run。

### 7.7 Schema 浏览与 DDL

- [ ] P1 展示外键。
- [ ] P1 展示 views。
- [ ] P1 展示 triggers。
- [ ] P1 索引按 index name 分组展示。
- [ ] P1 DDL 模板增加 modify column。
- [ ] P1 DDL 模板增加 drop column。
- [ ] P1 高风险 DDL 模板标记风险。
- [ ] P2 支持复制 CREATE TABLE。
- [ ] P2 支持复制 SELECT COUNT、SELECT sample 等常用 SQL。
- [ ] P2 支持数据库对象搜索。
- [ ] P3 schema diff。
- [ ] P3 ER 图。

### 7.8 UI/UX

- [ ] P1 统一中英文界面文案，确定默认语言策略。
- [ ] P1 补充 loading、empty、error 状态。
- [ ] P1 改进可访问性：按钮 aria-label、键盘导航、焦点状态。
- [ ] P1 改进危险操作确认对话框信息密度。
- [ ] P1 保证小窗口下工具栏不溢出。
- [ ] P1 增加应用设置页。
- [ ] P2 支持深色模式。
- [ ] P2 支持命令面板。
- [ ] P2 支持更多快捷键。
- [ ] P2 支持 tab 拖拽排序。
- [ ] P2 支持关闭其他 tab / 关闭右侧 tab。

### 7.9 工程化与测试

- [x] P0 添加 CI：Go test、frontend build。
- [x] P0 添加基础 Go 单元测试。（app_test.go 覆盖配置规范化、DSN/TLS、identifier quoting、where 过滤、错误分类、SSH auth/host key）
- [x] P0 建立性能基线：启动、schema 展开、表格渲染、查询结果渲染。（操作日志按 perf 标签聚合 startup/connect/schema/tableLoad/query 的最近/平均/峰值，状态栏可见，见 docs/PERFORMANCE.md）
- [ ] P1 拆分 `frontend/src/App.vue`，降低单文件复杂度。
- [ ] P1 添加前端 lint/format 工具。
- [ ] P1 添加前端单元测试。
- [ ] P1 添加端到端冒烟测试。
- [ ] P1 添加测试用 MySQL docker compose。
- [ ] P1 添加 mock backend 或 demo mode 测试入口。
- [ ] P2 添加性能基准：大表分页、大结果渲染、CSV 导入。
- [ ] P2 添加依赖更新策略。

### 7.10 打包与发布

- [x] P0 明确本地 Wails wrapper 脚本的原因和适用范围。（见 docs/RELEASE.md）
- [x] P0 增加 macOS release 构建说明。（见 docs/RELEASE.md）
- [ ] P1 增加 GitHub Actions release workflow。
- [ ] P1 生成 macOS artifact。
- [ ] P1 生成 Windows artifact。
- [ ] P1 生成 Linux artifact。
- [ ] P1 完善 app icon 和平台 metadata。
- [ ] P2 macOS 签名和公证。
- [ ] P2 Windows installer。
- [ ] P2 Linux AppImage/deb/rpm 方案。
- [ ] P3 自动更新机制。

## 8. 建议的近期迭代顺序

### Sprint 1：开源可读性和安全说明

目标：让项目可以公开展示，不让用户误解成熟度。

任务：

- LICENSE。
- CONTRIBUTING。
- SECURITY。
- README 平台支持矩阵。
- README 截图。
- CI 跑 frontend build 和 Go test。
- 标注 SSH host key verification 和 SSL/TLS 当前状态。

### Sprint 2：性能基线与大库体验

目标：让 RowPort 的差异点落到可测量的速度和流畅度上。

任务：

- 记录启动耗时。
- 记录 schema 展开耗时。
- 记录表格首屏渲染耗时。
- 记录查询结果渲染耗时。
- 表格渲染准备虚拟滚动方案。
- schema lazy load 和手动刷新策略。

### Sprint 3：连接安全补齐

目标：解决数据库客户端最敏感的连接安全问题。

任务：

- MySQL SSL/TLS 配置。
- SSH host key verification。
- 连接错误分类。
- 连接测试结果显示更详细的协议状态。
- 后端连接相关单元测试。

### Sprint 4：查询取消与 SQL 工作流

目标：减少长查询导致的卡顿和不可控。

任务：

- 后端支持 query id / cancel。
- 前端 busy 状态改为可取消状态。
- 查询历史按 profile/database 归属。
- SQL 执行模式区分当前语句、选区、全部。

### Sprint 5：表数据安全编辑

目标：让编辑数据更可控。

任务：

- 变更 SQL 预览。
- 无 primary key 表只读提示。
- 唯一索引编辑策略。
- 结构化多条件过滤器。
- long text / JSON 单元格详情。

### Sprint 6：导入导出升级

目标：让 CSV 工作流进入可放心使用状态。

任务：

- CSV 字段映射。
- NULL 映射。
- 错误行报告。
- 分批导入。
- 全量导出过滤结果。

## 9. 开源贡献方向

适合新贡献者的任务：

- README 和 FAQ 改进。
- issue template。
- 错误消息优化。
- 前端小组件拆分。
- SQL 模板补充。
- schema 展示字段补充。
- Go 单元测试。

适合熟悉安全和网络的贡献者：

- SSH host key verification。
- MySQL SSL/TLS。
- Windows/Linux 凭据存储。
- 查询取消和连接生命周期。

适合前端贡献者：

- SQL 编辑器升级。
- 表格交互优化。
- 可访问性改进。
- 深色模式。
- CSV 映射 UI。

不建议新贡献者一开始做的任务：

- 多数据库支持。
- 插件系统。
- 大规模重写前端框架。
- 云同步或账号系统。
- AI SQL 生成。

## 10. 发布质量标准

每个可公开 release 至少满足：

- README 中说明当前版本状态和已知限制。
- `npm run build` 通过。
- `go test ./...` 通过。
- 手动验证至少覆盖：
  - 新建 profile。
  - 测试连接。
  - 普通 MySQL 连接。
  - SSH 隧道连接。
  - schema 浏览。
  - 表分页读取。
  - SQL SELECT。
  - 单行插入、编辑、删除。
  - CSV/JSON 导出。
  - 断开连接。
- release notes 包含：
  - 新功能。
  - 修复。
  - 安全相关变化。
  - 已知问题。

## 11. 风险清单

安全风险：

- 未验证 SSH host key 会让用户暴露在中间人攻击风险下。
- 未支持 TLS verify 会让远程 MySQL 连接缺少完整链路安全。
- 危险 SQL 的前端确认只能减少误操作，不能当作权限边界。

数据风险：

- CSV 导入如果没有错误行报告，用户很难判断是否部分成功。
- 无 primary key 表强行编辑可能更新错误行，因此必须默认只读。
- 大范围 UPDATE/DELETE 必须继续保持强提醒。

工程风险：

- `frontend/src/App.vue` 体量过大，会让后续迭代变慢。
- 缺少测试会使连接、SQL 和数据变更逻辑难以安全演进。
- 没有 CI 会降低外部贡献质量。

产品风险：

- 如果过早扩展多数据库，MySQL 核心体验会被稀释。
- 如果加入太多 IDE 功能，轻量定位会模糊。
- 如果没有持续测量性能，RowPort 会失去区别于重型客户端的核心理由。
- 如果文档没有说明 early preview 状态，开源用户可能对稳定性预期过高。

## 12. 决策记录

当前建议保留的决策：

- 继续使用 Wails + Go + Vue。
- 短期只支持 MySQL。
- 本地优先，不引入远程账号体系。
- 凭据使用平台 credential store，不写入普通配置文件。
- 无 primary key 表默认只读。
- 高风险 SQL 和 DDL 必须有确认或明显风险提示。

未来需要重新评估的决策：

- 是否引入成熟 SQL editor 依赖。
- 是否引入前端组件库，还是继续自维护 IDE 风格 UI。
- 是否支持 PostgreSQL。
- 是否支持自动更新。
- 是否支持 profile 加密导入导出。

## 13. 维护建议

- 每完成一个 Sprint，更新本文档的 TODO 状态。
- 每次 release 前，把已完成事项同步到 `CHANGELOG.md`。
- 对安全相关 TODO 单独开 issue 并标注 `security`。
- 对适合新贡献者的任务标注 `good first issue`。
- 不把长期方向混入近期 milestone，避免路线图失焦。
