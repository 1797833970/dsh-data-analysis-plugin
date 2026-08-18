/** `dataAnalysis` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'dataAnalysis'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'report.title': '分析报告',
} satisfies Record<string, string>

/** Union of this namespace's dictionary keys. */
export type DataAnalysisKey = keyof typeof zh

/** English dictionary (same key set). */
export const en: Record<DataAnalysisKey, string> = {
  'report.title': 'Analysis report',
}
