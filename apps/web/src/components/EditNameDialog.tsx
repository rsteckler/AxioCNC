import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  initialValue: string
  onSave: (value: string) => void
  placeholder?: string
}

/**
 * Reusable dialog for editing a name/value
 * 
 * Provides a consistent pattern for editing names with validation
 */
export function EditNameDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue,
  onSave,
  placeholder = '',
}: EditNameDialogProps) {
  const [value, setValue] = useState(initialValue)

  // Reset value when dialog opens or initialValue changes
  useEffect(() => {
    if (open) {
      setValue(initialValue)
    }
  }, [open, initialValue])

  const handleSave = () => {
    onSave(value)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder || label}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
