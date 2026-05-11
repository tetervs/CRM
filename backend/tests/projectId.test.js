const { generateProjectId } = require('../utils/projectId')

describe('generateProjectId', () => {
  test('first project in a department is P1', () => {
    const date = new Date('2026-05-11')
    expect(generateProjectId('FIS', 0, date)).toBe('INQ/FIS/P1/MAY26')
  })

  test('sequential numbering: third project is P3', () => {
    const date = new Date('2026-05-11')
    expect(generateProjectId('FIS', 2, date)).toBe('INQ/FIS/P3/MAY26')
  })

  test('different departments are independent', () => {
    const date = new Date('2026-05-11')
    expect(generateProjectId('IT', 0, date)).toBe('INQ/IT/P1/MAY26')
  })

  test('month and year are from conversion date', () => {
    const date = new Date('2025-01-15')
    expect(generateProjectId('OPS', 0, date)).toBe('INQ/OPS/P1/JAN25')
  })

  test('december wraps correctly', () => {
    const date = new Date('2026-12-01')
    expect(generateProjectId('FIS', 4, date)).toBe('INQ/FIS/P5/DEC26')
  })
})
