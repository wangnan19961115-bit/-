# SymptomMate 模拟埋点看板报告

日期：2026-06-08

## 本轮范围

本轮执行第三步：接入模拟埋点看板。目标是在不引入后端的前提下，用本地浏览器数据验证 MVP 核心指标。

## 新增能力

- 完成自查时记录 `session_complete` 事件。
- 用户点击反馈时记录 `feedback` 事件。
- 新增“我的 → 数据看板”入口。
- 新增本地数据看板页面，展示：
  - 完成自查次数
  - 红线触发次数
  - 反馈数
  - 负向反馈率
  - 红/黄/绿分布
  - 高频症状
  - 用户反馈分布
  - 最近事件
- 支持清空看板数据。

## 本地数据来源

- `symptomMateHistory`：自查历史记录
- `symptomMateFeedback`：用户反馈记录
- `symptomMateEvents`：模拟埋点事件

## 验证结果

已运行：

```powershell
node --check app.js
node --check symptom-config.js
node --check medical-rules.js
```

结果：全部通过。

本地静态服务已启动，访问：

```text
http://127.0.0.1:5173
```

进入路径：

```text
我的 → 数据看板
```

## 说明

当前看板仅使用本机浏览器数据，不代表真实线上数据。后续如果接入后端，可以将 `recordAnalyticsEvent()` 替换为 API 上报，同时保留当前页面作为运营看板原型。
