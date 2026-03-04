import { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delayDuration?: number;
  closeDelay?: number;
  interactive?: boolean;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  delayDuration = 200,
  closeDelay = 260,
  interactive = true
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [tooltipSide, setTooltipSide] = useState(side);
  const openTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const clearOpenTimer = () => {
    if (openTimeoutId.current) {
      clearTimeout(openTimeoutId.current);
      openTimeoutId.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimeoutId.current) {
      clearTimeout(closeTimeoutId.current);
      closeTimeoutId.current = null;
    }
  };

  const openTooltip = () => {
    clearCloseTimer();
    setIsOpen(true);
    requestAnimationFrame(() => {
      updatePosition();
    });
  };

  const scheduleOpen = () => {
    clearOpenTimer();
    clearCloseTimer();
    openTimeoutId.current = setTimeout(() => {
      openTooltip();
    }, delayDuration);
  };

  const scheduleClose = () => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimeoutId.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  };

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let currentSide = side;

    // Calculate position based on side
    switch (side) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        // If tooltip goes off top, switch to bottom
        if (top < 0) {
          currentSide = 'bottom';
          top = triggerRect.bottom + 8;
        }
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        // If tooltip goes off bottom, switch to top
        if (top + tooltipRect.height > viewportHeight) {
          currentSide = 'top';
          top = triggerRect.top - tooltipRect.height - 8;
        }
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        // If tooltip goes off left, switch to right
        if (left < 0) {
          currentSide = 'right';
          left = triggerRect.right + 8;
        }
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + 8;
        // If tooltip goes off right, switch to left
        if (left + tooltipRect.width > viewportWidth) {
          currentSide = 'left';
          left = triggerRect.left - tooltipRect.width - 8;
        }
        break;
    }

    // Keep tooltip within viewport horizontally
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }

    // Keep tooltip within viewport vertically
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    setPosition({ top, left });
    setTooltipSide(currentSide);
  };

  const handleTriggerMouseEnter = () => {
    scheduleOpen();
  };

  const handleTriggerMouseLeave = () => {
    if (interactive) {
      scheduleClose();
      return;
    }
    clearOpenTimer();
    setIsOpen(false);
  };

  const handleTooltipMouseEnter = () => {
    if (!interactive) return;
    clearCloseTimer();
  };

  const handleTooltipMouseLeave = () => {
    if (!interactive) return;
    scheduleClose();
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleResize = () => updatePosition();
      const handleScroll = () => updatePosition();
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };

      const observers: ResizeObserver[] = [];
      if (typeof ResizeObserver !== 'undefined') {
        if (tooltipRef.current) {
          const tooltipObserver = new ResizeObserver(() => updatePosition());
          tooltipObserver.observe(tooltipRef.current);
          observers.push(tooltipObserver);
        }
        if (triggerRef.current) {
          const triggerObserver = new ResizeObserver(() => updatePosition());
          triggerObserver.observe(triggerRef.current);
          observers.push(triggerObserver);
        }
      }

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('keydown', handleEscape);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('keydown', handleEscape);
        observers.forEach((observer) => observer.disconnect());
      };
    }
  }, [isOpen, side, content]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, []);

  const getArrowStyles = (side: string) => {
    const baseStyles = {
      borderWidth: '6px',
      borderStyle: 'solid',
      borderColor: 'transparent'
    };
    
    switch (side) {
      case 'top':
        return { ...baseStyles, top: '100%', left: '50%', transform: 'translateX(-50%)', borderTopColor: '#ffffff' };
      case 'bottom':
        return { ...baseStyles, bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderBottomColor: '#ffffff' };
      case 'left':
        return { ...baseStyles, left: '100%', top: '50%', transform: 'translateY(-50%)', borderLeftColor: '#ffffff' };
      case 'right':
        return { ...baseStyles, right: '100%', top: '50%', transform: 'translateY(-50%)', borderRightColor: '#ffffff' };
      default:
        return baseStyles;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        {children}
      </div>
      {isOpen && createPortal(
        <div
          ref={tooltipRef}
          className={`bg-white p-3 border border-gray-200 shadow-lg rounded-md text-sm z-[99999] max-w-xs ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
          role="tooltip"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {content}
          {/* Arrow matching the tooltip background */}
          <div
            className="absolute w-0 h-0"
            style={{
              ...getArrowStyles(tooltipSide)
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
