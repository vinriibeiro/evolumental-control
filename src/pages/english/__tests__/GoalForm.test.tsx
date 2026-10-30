import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GoalForm } from '../GoalForm'

const field = () => screen.getByLabelText('Meta diária (min)') as HTMLInputElement
const saveButton = () => screen.getByRole('button', { name: 'Salvar' })

describe('GoalForm', () => {
  it('sincroniza o campo quando a meta persistida muda de 20 para 45 e salva o valor atual', () => {
    const onSave = vi.fn()
    const { rerender } = render(<GoalForm goal={20} onSave={onSave} />)
    expect(field().value).toBe('20')

    rerender(<GoalForm goal={45} onSave={onSave} />)
    expect(field().value).toBe('45')

    fireEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(45)
  })

  it('preserva a edição em andamento quando a meta persistida muda', () => {
    const onSave = vi.fn()
    const { rerender } = render(<GoalForm goal={20} onSave={onSave} />)
    fireEvent.change(field(), { target: { value: '30' } })

    rerender(<GoalForm goal={45} onSave={onSave} />)
    expect(field().value).toBe('30')

    fireEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(30)
  })

  it('rejeita meta inválida sem salvar', () => {
    const onSave = vi.fn()
    const onInvalid = vi.fn()
    render(<GoalForm goal={20} onSave={onSave} onInvalid={onInvalid} />)
    fireEvent.change(field(), { target: { value: '0' } })
    fireEvent.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
    expect(onInvalid).toHaveBeenCalledOnce()
  })
})
