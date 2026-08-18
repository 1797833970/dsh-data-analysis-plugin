/**
 * Data-analysis skill family: a coarse orchestrator plus five focused skills
 * (cleaning, EDA, visualization, modeling, reporting), each registered as an
 * embedded runtime skill. The recipes are written inline so the model can use
 * them directly; the same helpers are also shipped as a Python toolbox under
 * `toolbox/` for deployments that wire `dsh-code-runtime-python.toolboxDirs`.
 * @module @andy1797833970/dsh-skill-data-analysis
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-skill'

export const name = 'skill-data-analysis'
export const inject = ['skills']

/** One embedded skill contribution. */
interface SkillSpec {
  readonly name: string
  readonly description: string
  readonly whenToUse: string
  readonly content: string
}

const ORCHESTRATOR = `你是数据分析智能体。这是一个多技能工作流，每个阶段对应一个更细的技能：
- data-cleaning：数据清洗
- eda：探索性分析
- data-visualization：可视化图表
- ml-modeling：机器学习建模
- report-writing：报告撰写

Python 导入规则：只 import pandas/numpy/matplotlib/sklearn 以及 json/math/statistics/datetime/collections 等白名单标准库。禁止 import os/sys/subprocess/pathlib/shutil。数据文件统一由 load_table 读取，路径一律用相对文件名写当前工作目录，不要用 os.path 或绝对路径拼中间文件。

run_code 已经处于异步执行环境：直接写顶层 await tools.xxx(...)，不要定义 async def main() 后再调用 asyncio.run(main())，也不要写 if __name__ == '__main__'。

总体流程：
1. load_table(path, question) 登记文件；它会自动解析（支持 CSV/TSV/XLSX/JSON/Parquet 等，自动处理 UTF-8/GBK 编码与分隔符），返回 schema，并生成 loaded.parquet。
2. 加载 data-cleaning 技能，先用 pd.read_parquet('loaded.parquet') 读数据，再清洗，把结果写 clean.parquet。
3. 闸门 ask_user_question：继续下一步 / 重新分析。
4. set_route 固定路线：viz（描述性+可视化）或 ml（分类/回归）。
5. 加载 eda 技能，做探索性分析并记录关键发现。
6. 闸门确认 EDA 结论。
7. viz 路线：加载 data-visualization，生成 ECharts 图表逐张 save_chart。
   ml 路线：加载 ml-modeling，特征构建 → 模型方案 → 训练 → 指标。
8. 闸门确认结果。
9. 加载 report-writing，save_report 保存报告，export_pdf 导出。

若 load_table 报“找不到文件”，向用户要完整绝对路径（如 D:\\...\\file.csv），不要自己猜相对路径，也不要跳过 load_table 直接用 pd.read_csv。

全自动模式：若 autoMode=true（问题含 全自动/自动分析/自动跑/auto），跳过所有闸门一路跑完；默认走 viz 路线，除非问题明确要预测。

每个阶段用 run_code 执行。每次 run 无状态：中间结果只写 parquet 文件到当前工作目录（如 loaded.parquet、clean.parquet），下一阶段再读。使用相对文件名，不要写回数据文件所在目录。`

const CLEANING = `数据清洗技能。优先用向量化 pandas 操作，避免逐行 for 循环。

读取文件：load_table 已生成 loaded.parquet，直接 df = pd.read_parquet('loaded.parquet')。若需自己读原始文件，用 pandas 直接读取（自动处理格式与中文编码）。

可用工具箱（若已配置可导入）：from toolbox.cleaning import drop_duplicates_and_fill, convert_dtypes, remove_outliers_iqr

标准做法：
1. 先了解问题：打印 df.shape、df.columns、df.dtypes、df.isna().sum()、df.duplicated().sum()。
2. 去重：df = df.drop_duplicates(keep='first')
3. 缺失值：数值列填中位数 df[col].fillna(df[col].median())；类别列填众数 df[col].fillna(df[col].mode().iloc[0])。
4. 类型转换：df[col] = pd.to_numeric(df[col], errors='coerce')。
5. 异常值（IQR 法）：
   q1, q3 = df[col].quantile([0.25, 0.75])
   iqr = q3 - q1
   df = df[(df[col] >= q1 - 1.5 * iqr) & (df[col] <= q3 + 1.5 * iqr)]
6. 完成后打印清洗前后对比（行数、缺失数、重复数），并把结果写文件：df.to_parquet('clean.parquet', engine='pyarrow')。使用相对文件名写当前工作目录，不要写回数据文件所在目录。

若数据已经足够干净，直接写文件并结束，不要做多余变换。`

const EDA = `探索性分析技能。围绕用户问题做描述统计、分组聚合、相关性与趋势，为可视化和报告提供依据。

读取数据：df = pd.read_parquet('clean.parquet')（上一步清洗结果）。

可用工具箱（若已配置可导入）：from toolbox.eda import summarize, correlation_matrix, top_groups

清单：
- 数值列：df.describe()，关注均值、分位数、标准差。
- 类别列：df[col].value_counts()。
- 分组聚合：df.groupby(by)[target].agg(['sum','mean','count']).sort_values(by, ascending=False)。
- 相关性：df.select_dtypes(include='number').corr()。
- 时间趋势：按时间列分组求和/均值。
- 打印具体数字和分组结果，不要只给结论。`

const VISUALIZATION = `可视化技能。必须基于数据里的实际列名做聚合计算，生成 2-4 张有业务意义的 ECharts 图表，逐张 save_chart。

读取数据：df = pd.read_parquet('clean.parquet')（上一步清洗结果）。

可用工具箱（若已配置可导入）：from toolbox.viz import bar_option, line_option, pie_option

规则：
- 每个 option 必须含 title.text 和非空 series；按图表类型含 xAxis/yAxis 或 data。
- 先用 pandas 算好聚合结果，再构建 option。
- 禁止输出空数组 []。
- 示例（列为 category 和 amount 时）：
  option = {
    "title": {"text": "各类别销售额"},
    "xAxis": {"type": "category", "data": ["电子", "家具"]},
    "yAxis": {"type": "value"},
    "series": [{"type": "bar", "data": [120, 80]}]
  }
- 逐张 save_chart(option)，不要一次性保存多张。`

const MODELING = `机器学习建模技能。仅分类与回归，不做聚类或时序预测。

读取数据：df = pd.read_parquet('clean.parquet')（上一步清洗结果）。

可用工具箱（若已配置可导入）：from toolbox.modeling import train_classifier, train_regressor

- 特征构建：one-hot、标准化、日期特征等，用向量化操作，打印特征形状。
- 模型方案：先确定任务类型（classification/regression）、目标列、候选模型。
- 候选模型：LogisticRegression / RandomForest / GradientBoosting。
- 训练：train_test_split + 简单交叉验证。
- 分类指标：accuracy / F1 / ROC-AUC；回归指标：RMSE / MAE / R²。
- 打印每类指标的数值，不要只给结论。`

const REPORTING = `报告撰写技能。根据前面所有阶段的结果写 Markdown 报告，结构如下：
数据概览、关键发现（引用具体数字）、图表说明、结论与建议。

生成 markdown 时不要使用三引号字符串。用 Python 列表收集每一行，再用 "\\n".join(lines) 拼接；每个字符串内容必须从引号后第 0 列开始，前面不要有空格。

示例：
lines = [
    "# 报告标题",
    "",
    "## 一、数据概览",
    "",
    "- 样本量：147 行",
]
markdown = "\\n".join(lines)
report = await tools.save_report({"markdown": markdown})

写好后调用 save_report(markdown)，再 export_pdf(reportId)。不要在普通聊天回复里重复完整 Markdown 正文；报告卡片会在 GUI 里渲染，聊天里只给一个简短总结。`

const SKILLS: readonly SkillSpec[] = [
  {
    name: 'data-analysis',
    description: '数据分析智能体总编排：登记数据、分阶段清洗/探索/可视化/建模、产出报告。',
    whenToUse: '用户上传表格数据并要求分析、清洗、可视化、建模或生成报告时。',
    content: ORCHESTRATOR,
  },
  {
    name: 'data-cleaning',
    description: '数据清洗配方：去重、缺失值、类型转换、异常值处理。',
    whenToUse: '需要清洗表格数据时。',
    content: CLEANING,
  },
  {
    name: 'eda',
    description: '探索性分析清单：描述统计、分组聚合、相关性与趋势。',
    whenToUse: '需要理解数据分布与规律时。',
    content: EDA,
  },
  {
    name: 'data-visualization',
    description: '可视化规则：用 ECharts option 生成业务图表。',
    whenToUse: '需要生成交互式图表时。',
    content: VISUALIZATION,
  },
  {
    name: 'ml-modeling',
    description: '机器学习建模：分类/回归的特征构建、模型方案与训练指标。',
    whenToUse: '需要训练分类或回归模型时。',
    content: MODELING,
  },
  {
    name: 'report-writing',
    description: '报告撰写结构：数据概览、关键发现、图表说明、结论建议。',
    whenToUse: '需要生成最终分析报告时。',
    content: REPORTING,
  },
]

/**
 * Register the data-analysis skill family on `ctx.skills`.
 * @param ctx - registrant context carrying the skill registry.
 */
export function apply(ctx: Context): void {
  for (const skill of SKILLS) {
    ctx.effect(() => ctx.skills.register({
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse,
      content: skill.content,
      source: 'bundled',
    }))
  }
}
