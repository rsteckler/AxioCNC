import React from 'react'
import { Target, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import type { ZeroingMethod } from '../../../shared/schemas/settings'

interface ZeroingWizardProps {
  method: ZeroingMethod
  totalSteps: number
  currentStep: number
  isFirstStep: boolean
  isLastStep: boolean
  onNext: () => void
  onBack: () => void
  onComplete: () => void
  onClose: () => void
  canGoNext?: boolean
  isFirstToolChange?: boolean // For bitsetter: determines title (First Tool vs Subsequent Tools)
  children: React.ReactNode
}

/**
 * Base ZeroingWizard component that provides common layout, navigation, and progress indicator
 * Method-specific wizards should wrap their step content with this component
 */
export function ZeroingWizard({
  method,
  totalSteps,
  currentStep,
  isFirstStep,
  isLastStep,
  onNext,
  onBack,
  onComplete,
  onClose,
  canGoNext = true,
  isFirstToolChange = true,
  children,
}: ZeroingWizardProps) {
  const getTitle = () => {
    if (method.type === 'bitsetter') {
      return isFirstToolChange ? 'BitSetter (First Tool)' : 'BitSetter (Subsequent Tools)'
    }
    return method.name
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">{getTitle()}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
      
      {/* Progress indicator - full width with justified steps */}
      <div className="relative w-full py-2 mb-4">
        {/* Full-width connecting line behind circles */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-muted" />
        
        {/* Steps container with justify-between - first on left, last on right, middle centered */}
        <div className="relative flex items-center justify-between w-full">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNum = index + 1
            const isActive = stepNum === currentStep
            const isComplete = stepNum < currentStep
            
            return (
              <div
                key={stepNum}
                className="relative z-10"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-2 border-background'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : stepNum}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Progress line that extends as steps are completed */}
        {currentStep > 1 && (
          <div 
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-green-500 transition-all duration-300 z-0"
            style={{
              left: '16px', // Half of circle width (w-8 = 32px, so 16px is center)
              width: totalSteps === 3
                ? currentStep === 2 
                  ? 'calc(50% - 32px)' // To middle of second circle
                  : 'calc(100% - 32px)' // To middle of third circle
                : currentStep === totalSteps
                ? 'calc(100% - 32px)'
                : `calc(${((currentStep - 1) / (totalSteps - 1)) * 100}% - 32px)`
            }}
          />
        )}
      </div>
      
      {/* Step content */}
      <OverlayScrollbarsComponent 
        className="flex-1 min-h-0 mb-4"
        options={{ 
          scrollbars: { autoHide: 'scroll', autoHideDelay: 400 }
        }}
      >
        {children}
      </OverlayScrollbarsComponent>
      
      {/* Navigation buttons */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        {!isFirstStep && (
          <Button
            variant="outline"
            onClick={onBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <div className="flex-1" />
        {isLastStep ? (
          <Button onClick={onComplete} className="gap-2">
            <Check className="w-4 h-4" />
            Complete
          </Button>
        ) : (
          <Button 
            onClick={onNext} 
            className="gap-2"
            disabled={!canGoNext}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
