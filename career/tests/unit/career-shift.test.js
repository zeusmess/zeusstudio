import { describe, expect, it } from 'vitest'
import { gradeExam, gradeInterview, INTERVIEW_QUESTIONS, isFastTrack, requirementsFor, RANKS } from '../../src/systems/career/career.js'
import { CERTS, drawQuestions, QUESTIONS } from '../../src/systems/career/quizBank.js'
import { gradeShift, isOnShift, phaseFor } from '../../src/systems/shift/shift.js'

describe('certification exams', () => {
  it('have a bank of at least 15 valid questions per certificate', () => {
    for (const id of Object.keys(CERTS)) {
      const bank = QUESTIONS[id]
      expect(bank.length, id).toBeGreaterThanOrEqual(15)
      for (const q of bank) {
        expect(q.options.length).toBeGreaterThanOrEqual(3)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(q.options.length)
        expect(q.why, q.q).toBeTruthy()
      }
    }
  })

  it('draw 10 different questions and shuffle the options without losing the right answer', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const exam = drawQuestions('basics', 10, rand)
    expect(exam).toHaveLength(10)
    expect(new Set(exam.map((q) => q.bankIndex)).size).toBe(10)
    for (const q of exam) {
      const original = QUESTIONS.basics[q.bankIndex]
      expect(q.options[q.answer]).toBe(original.options[original.answer])
    }
  })

  it('pass at the certificate threshold', () => {
    const exam = { certId: 'basics', questions: drawQuestions('basics', 10) }
    const right = exam.questions.map((q) => q.answer)
    expect(gradeExam(exam, right)).toMatchObject({ score: 100, passed: true })
    const eight = right.map((a, i) => (i < 2 ? -1 : a))
    expect(gradeExam(exam, eight)).toMatchObject({ score: 80, passed: true })
    const seven = right.map((a, i) => (i < 3 ? -1 : a))
    expect(gradeExam(exam, seven).passed).toBe(false)
  })
})

describe('promotion interviews', () => {
  it('have five situations per promotion with one best answer each', () => {
    for (const key of ['trainer', 'supervisor', 'asm', 'manager']) {
      const qs = INTERVIEW_QUESTIONS[key]
      expect(qs).toHaveLength(5)
      for (const q of qs) expect(q.options.filter((o) => o.score === 2)).toHaveLength(1)
    }
  })

  it('pass from 70%', () => {
    const best = INTERVIEW_QUESTIONS.supervisor.map((q) => q.options.findIndex((o) => o.score === 2))
    expect(gradeInterview('supervisor', best)).toMatchObject({ pct: 100, passed: true })
    const worst = INTERVIEW_QUESTIONS.supervisor.map((q) => q.options.findIndex((o) => o.score === 0))
    expect(gradeInterview('supervisor', worst).passed).toBe(false)
  })
})

describe('the career ladder', () => {
  it('runs Barista → Trainer → Supervisor → ASM → Manager → honorary Area Manager', () => {
    expect(RANKS.map((r) => r.key)).toEqual(['barista', 'trainer', 'supervisor', 'asm', 'manager', 'area'])
  })

  it('lets a registered job title skip mission and KPI targets but never the certificate', () => {
    expect(isFastTrack('supervisor', 'shift_supervisor')).toBe(true)
    expect(isFastTrack('asm', 'shift_supervisor')).toBe(false)
    const state = { sbc: {}, day: 1 }
    const req = requirementsFor(state, 'supervisor', 'shift_supervisor')
    expect(req.fastTrack).toBe(true)
    expect(req.ready).toBe(false) // certificates still missing
    expect(req.items.filter((i) => i.kind === 'cert').every((i) => !i.waived)).toBe(true)
    state.sbc.career = { certs: { coffee: { passed: true }, nsf: { passed: true } } }
    expect(requirementsFor(state, 'supervisor', 'shift_supervisor').ready).toBe(true)
    expect(requirementsFor(state, 'supervisor', 'barista').ready).toBe(false)
  })
})

describe('shift management', () => {
  it('splits the day into opening, peak and closing', () => {
    expect(phaseFor(400).key).toBe('opening')
    expect(phaseFor(700).key).toBe('peak')
    expect(phaseFor(1000).key).toBe('closing')
  })

  it('puts partners on the floor by their schedule', () => {
    const state = { day: 1, dayMinutes: 700, sbc: {} }
    expect(isOnShift(state, { id: 1, shift: 'morning' })).toBe(true)
    expect(isOnShift(state, { id: 2, shift: 'evening' })).toBe(false)
    expect(isOnShift(state, { id: 3, shift: 'morning', sickLeave: true })).toBe(false)
    state.dayMinutes = 1000
    expect(isOnShift(state, { id: 1, shift: 'morning' })).toBe(false)
    expect(isOnShift(state, { id: 2, shift: 'evening' })).toBe(true)
  })

  it('grades a clean, well-staffed shift A and a chaotic one low', () => {
    const good = gradeShift({ orders: 40, angry: 0, fast: 36, sales: 400, laborCost: 85, breakViolations: 0, drbDue: 2, drbDone: 2, incidentTimeouts: 0 }, { cleanliness: 95, machineHealth: 95 })
    expect(['A+', 'A']).toContain(good.grade)
    expect(good.laborOnTarget).toBe(true)
    const bad = gradeShift({ orders: 20, angry: 6, fast: 2, sales: 100, laborCost: 60, breakViolations: 2, drbDue: 2, drbDone: 0, incidentTimeouts: 1 }, { cleanliness: 50, machineHealth: 50, openComplaints: 2 })
    expect(['D', 'F']).toContain(bad.grade)
    expect(bad.laborPct).toBe(60)
  })
})
