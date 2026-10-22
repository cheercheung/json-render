# json-render + openai decision model

[English](README.md) | [简体中文](README.zh-CN.md)

## 录屏示例

https://github.com/user-attachments/assets/4ca2a733-8e4a-478a-9b0f-4e284e805722

[下载英文联系表单任务的原始录屏](docs/media/luna-contact-form.mp4)（31.76 秒，原速，未剪辑）。

2026-10-22 的这次录制中，界面组合耗时 **2.471 秒**，使用 **2 次评估器调用**，报告 **11,840 个输入 token**。必填字段、错误邮箱和有效提交提示均通过验证。这些数据仅描述一次本地验收，不代表延迟基准或价格对比；实际账单尚未核对。

[阅读验证结果与已知限制（英文）](docs/evolink-validation.md)。

## 项目介绍

让 AI 根据自然语言需求，使用应用提供的组件、数据和操作，组合出可交互的界面。

基于 [Vercel Labs 的 json-render](https://github.com/vercel-labs/json-render)，本版本在原有 **default** 和 **Jev** 模式之外，新增 **OpenAI Luna Decision**，用于选择组件和安排布局，保留上游框架和 Apache-2.0 许可证。

## 给谁用？

- **开发 AI 助手的开发者**：希望在对话中展示可交互的表单、卡片、图表和数据看板。
- **需要动态界面的产品团队**：希望页面字段、区块或布局能随着用户需求变化。
- **评估决策模型的开发者**：希望用模型选择组件、安排布局，并查看决策过程和流式预览。

开发者提供组件实现、允许执行的操作和业务数据。框架负责结构化界面描述与渲染，模型参与决定展示哪些内容。

## 为什么要用？

对于固定页面，直接编写 React 组件通常更简单。当界面需要随用户请求变化时，json-render 才更容易体现价值。

| 需求 | 不使用 json-render | 使用 json-render |
| --- | --- | --- |
| 将需求转成界面 | 自行设计组件选择、布局和渲染协议 | 使用组件目录、JSON 页面描述和渲染器 |
| 让模型输出符合产品要求 | 自行定义并校验输出格式 | 按组件目录校验组件名称、属性、绑定和结构 |
| 复用已有设计和交互 | 逐个连接生成的视图与现有组件 | 注册组件和允许的操作处理函数后复用 |
| 边生成边展示 | 自行实现渐进式界面更新 | 将页面描述的流式更新交给现有预览渲染 |

本 fork 的 **Luna 模式**会从应用提供的组件候选中进行选择，并安排它们的布局。JSON 由应用代码组装和校验；标签、校验规则和操作绑定来自候选配置。决策模型负责组件选择与排列，组件实现和业务逻辑由开发者提供。

```text
用户需求 -> 组件与布局决策 -> 校验后的 JSON 页面描述 -> 可交互界面
```

default 模式保留上游的生成模型流程。框架还包含其他 Web 框架、移动端、PDF、邮件、视频和终端界面的渲染器，详见[上游参考说明（英文）](README.upstream.md)。

## 怎么用？

### 1. 克隆仓库并准备源码构建

Luna Decision 评估器是**本 fork 的源码新增功能**。仅安装上游发布的 npm 包，不会包含这部分接入。

环境要求：Node.js 24+、pnpm 11.1.3，以及全局可用的 `portless` 命令。以下工具版本用于本地验收：

```sh
npm install --global pnpm@11.1.3 portless@0.15.8

git clone https://github.com/cheercheung/json-render.git
cd json-render
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter web exec fumadocs-mdx
pnpm turbo run build --filter='web^...'
```

安装命令会跳过依赖的生命周期脚本，随后显式执行文档生成器和工作区依赖构建。请保留现有 lockfile。

### 2. 按所选模式配置环境变量和 Key

**仅在文件尚不存在时**，创建已被 Git 忽略的本地环境配置文件：

```sh
[ -f apps/web/.env.local ] || cp apps/web/.env.example apps/web/.env.local
chmod 600 apps/web/.env.local
```

使用编辑器打开 `apps/web/.env.local`。如果**只使用 OpenAI Luna Decision**，填写：

```dotenv
EVOLINK_API_KEY=your_evolink_api_key
```

本示例通过 EvoLink 调用 OpenAI Luna Decision。[获取 API Key](https://evolink.ai/dashboard/keys?utm_source=github&utm_medium=repo&utm_campaign=json-render&utm_content=quickstart)，然后将真实 Key 保存在 `.env.local` 或服务端环境变量中，不要填入示例文件或浏览器端代码。

| 模式或功能 | 环境变量 | 何时需要 |
| --- | --- | --- |
| **luna decision** | `EVOLINK_API_KEY` | Luna 界面组合必填；该模式不需要 Gateway 或 TypeSafe Key。 |
| **default** | `AI_GATEWAY_API_KEY` | 本地运行原有生成模型模式时必填；部署到 Vercel 时可使用上游 Gateway 身份验证流程。 |
| **jev** | `JEV_AI_GATEWAY_API_KEY` | Jev Playground 模式必填，值是独立的 **Vercel AI Gateway Key**；Gateway 账户必须允许 `typesafe-ai/jev`。 |
| 覆盖默认模型 | `AI_GATEWAY_MODEL` | 可选，仅影响 default 模式；源码默认值为 `anthropic/claude-haiku-4.5`。 |
| 共享请求限流 | `KV_REST_API_URL`、`KV_REST_API_TOKEN` | 可选，需成对配置，用于现有 Redis 限流；不配置时，本地演示使用不限制请求的占位实现。 |
| 限流参数 | `RATE_LIMIT_PER_MINUTE`、`RATE_LIMIT_PER_DAY` | 可选；配置限流后，默认值分别为 10 和 100。 |

只需填写所选模式对应的 Key，其他凭证可以留空。Luna 和 Jev 使用独立凭证，不会自动回退到其他供应商。所有 Key 都必须保留在服务端，不能添加 `NEXT_PUBLIC_` 前缀。修改环境变量后，请重启开发服务器。

### 3. 启动 Playground

```sh
PORTLESS_HTTPS=0 PORTLESS_PORT=1355 PORTLESS_SYNC_HOSTS=0 \
  PORTLESS_STATE_DIR="$PWD/.cache/portless" pnpm --filter web dev
```

此命令使用普通 HTTP 和当前项目目录中的代理状态文件，无需配置本地证书或 hosts 文件。打开 portless 输出的地址，通常为 **http://json-render.localhost:1355/playground**。如果 1355 端口已被其他代理占用，可通过 `PORTLESS_PORT` 选择其他代理端口。

发送任务前先选择 **luna decision**。页面初始选择的是 **default**，它需要自己的 Gateway 凭证。

可以先试录屏中使用的英文任务：

> Build a "Contact us" form with Full name, Email, Message, and a "Send message" button. Require all fields and validate email.

验收时检查：表单是否出现，空表单提交是否显示必填错误，错误邮箱是否被拒绝，以及正确填写后是否显示成功提示。此处的表单提交是本地校验和通知演示。实际发送消息或保存记录，需要自行实现并授权对应的后台操作。

### 4. 在自己的应用中使用评估器

构建本 fork 的包，将源码构建的 core 包与兼容渲染器一起使用。所有 `@json-render/*` 包应保持相同版本，并记录 fork 的 commit；仅凭上游包版本号无法识别这部分实验性新增功能。

```ts
// Server only. Supply your own catalog and candidate recipes.
import {
  experimental_composeSpec,
  experimental_createEvoLinkEvaluator,
} from "@json-render/core";
import { catalog, candidates } from "./your-ui-catalog";

const evaluate = experimental_createEvoLinkEvaluator({
  apiKey: process.env.EVOLINK_API_KEY ?? "",
});

for await (const event of experimental_composeSpec({
  catalog,
  candidates,
  prompt: "Build a contact form",
  evaluate,
  signal: AbortSignal.timeout(55_000),
})) {
  if (event.spec) {
    // Send each validated spec snapshot to your client-side renderer.
  }
}
```

示例中的组件目录、候选配置和客户端渲染器需要由你的应用提供。[阅读评估器配置与打包说明（英文）](EVOLINK_LOCAL.md)，[查看 Playground 的候选组件配置](apps/web/lib/jev/grammar.ts)，或[阅读上游框架 API 与渲染器参考（英文）](README.upstream.md)。

## 限制与开发检查

- Luna Playground 使用 `grammar.ts` 中预先提供的候选配置。新增任意字段、文案、数据或样式，需要应用提供相应候选，或使用 default 生成模式。
- 组件树通过校验，不等于模型一定正确理解了所有需求。请查看预览和决策过程，并使用自己的任务集验收。
- Playground 使用合成数据和演示操作。业务接入、身份验证、权限控制和部署仍由应用负责。
- `experimental_` API 可能变化。本 fork 尚未单独发布 npm 版本。
- 全仓类型检查仍有未改动文件 `packages/react-pdf/src/render.tsx:173` 的 TS2740 错误。相关 Web/core 检查和 87 个专项离线测试已通过，详见验证说明。

在仓库根目录执行以下专项测试，无需 API Key：

```sh
pnpm exec vitest run \
  packages/core/src/experimental-evolink-evaluator.test.ts \
  packages/core/src/experimental-evaluator.test.ts \
  packages/core/src/experimental-compose.test.ts \
  apps/web/lib/jev \
  apps/web/lib/use-playground-stream.test.ts
pnpm --filter web check-types
pnpm type-check
```

上游 npm 发布工作流已限制为仅在 `vercel-labs/json-render` 中运行，推送到本 fork 不会发布上游包。

## 来源与许可证

原始仓库：[vercel-labs/json-render](https://github.com/vercel-labs/json-render)，由 Vercel Labs 开发。

许可证：[Apache-2.0](LICENSE)。
