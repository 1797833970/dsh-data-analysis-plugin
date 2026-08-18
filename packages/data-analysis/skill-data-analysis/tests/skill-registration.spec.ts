import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillService from '@deepseek-ai/dsh-skill'
import * as SkillDataAnalysis from '../src/index.ts'

describe('skill-data-analysis registration', () => {
  it('registers 6 skills when plugin is loaded', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    // Access the skill registry through the internal layers to count registered skills
    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, unknown> } }
    }
    const globalRuntime = skillService.layers.global.runtime
    expect(globalRuntime.size).toBe(6)

    const skillNames = Array.from(globalRuntime.keys())
    expect(skillNames).toContain('data-analysis')
    expect(skillNames).toContain('data-cleaning')
    expect(skillNames).toContain('eda')
    expect(skillNames).toContain('data-visualization')
    expect(skillNames).toContain('ml-modeling')
    expect(skillNames).toContain('report-writing')

    await ctx.fiber.dispose()
  })

  it('each skill has source "bundled"', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { source: string }> } }
    }
    for (const [, skill] of skillService.layers.global.runtime) {
      expect(skill.source).toBe('bundled')
    }

    await ctx.fiber.dispose()
  })

  it('orchestrator skill contains key workflow steps', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { content: string }> } }
    }
    const orchestrator = skillService.layers.global.runtime.get('data-analysis')
    expect(orchestrator).toBeDefined()

    const content = orchestrator!.content
    // Check key workflow stages are mentioned
    expect(content).toContain('data-cleaning')
    expect(content).toContain('eda')
    expect(content).toContain('data-visualization')
    expect(content).toContain('ml-modeling')
    expect(content).toContain('report-writing')
    expect(content).toContain('load_table')
    expect(content).toContain('set_route')
    expect(content).toContain('save_chart')
    expect(content).toContain('save_report')
    expect(content).toContain('export_pdf')

    await ctx.fiber.dispose()
  })

  it('cleaning skill contains key cleaning steps', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { content: string }> } }
    }
    const cleaning = skillService.layers.global.runtime.get('data-cleaning')
    expect(cleaning).toBeDefined()

    const content = cleaning!.content
    expect(content).toContain('drop_duplicates')
    expect(content).toContain('fillna')
    expect(content).toContain('to_numeric')
    expect(content).toContain('IQR')
    expect(content).toContain('clean.parquet')

    await ctx.fiber.dispose()
  })

  it('visualization skill contains ECharts rules', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { content: string }> } }
    }
    const viz = skillService.layers.global.runtime.get('data-visualization')
    expect(viz).toBeDefined()

    const content = viz!.content
    expect(content).toContain('ECharts')
    expect(content).toContain('save_chart')
    expect(content).toContain('title.text')
    expect(content).toContain('series')

    await ctx.fiber.dispose()
  })

  it('modeling skill contains classification and regression', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { content: string }> } }
    }
    const modeling = skillService.layers.global.runtime.get('ml-modeling')
    expect(modeling).toBeDefined()

    const content = modeling!.content
    expect(content).toContain('LogisticRegression')
    expect(content).toContain('RandomForest')
    expect(content).toContain('GradientBoosting')
    expect(content).toContain('train_test_split')
    expect(content).toContain('accuracy')
    expect(content).toContain('RMSE')

    await ctx.fiber.dispose()
  })

  it('auto mode description is correct in orchestrator', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { content: string }> } }
    }
    const orchestrator = skillService.layers.global.runtime.get('data-analysis')
    const content = orchestrator!.content

    // Auto mode: skip gates, default viz route
    expect(content).toContain('全自动模式')
    expect(content).toContain('跳过所有闸门')
    expect(content).toContain('默认走 viz 路线')

    await ctx.fiber.dispose()
  })

  it('Python import restrictions are documented in orchestrator', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillService, {})
    await ctx.plugin(SkillDataAnalysis)

    const skillService = ctx.skills as unknown as {
      layers: { global: { runtime: Map<string, { content: string }> } }
    }
    const orchestrator = skillService.layers.global.runtime.get('data-analysis')
    const content = orchestrator!.content

    expect(content).toContain('禁止 import os/sys/subprocess/pathlib/shutil')

    await ctx.fiber.dispose()
  })
})
