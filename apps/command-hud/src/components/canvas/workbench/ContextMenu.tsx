import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
  onSelect?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

interface MenuLevelProps {
  items: MenuItem[];
  root?: boolean;
  onClose: () => void;
  onBack?: () => void;
}

const MENU_WIDTH = 232;
const ITEM_HEIGHT = 34;

const getMenuWidth = () => Math.min(MENU_WIDTH, Math.max(120, (window.innerWidth - 24) / 2));

const placeMenu = (x: number, y: number, itemCount: number) => {
  const menuWidth = getMenuWidth();
  const maxLeft = window.innerWidth - menuWidth - 8;
  let left = Math.max(8, Math.min(x, maxLeft));
  if (window.innerWidth < MENU_WIDTH * 2 + 24
    && left + menuWidth * 2 + 8 > window.innerWidth
    && left - menuWidth - 8 < 0) {
    left = x < window.innerWidth / 2 ? 8 : maxLeft;
  }
  return {
    left,
    top: Math.max(8, Math.min(y, window.innerHeight - Math.max(ITEM_HEIGHT, itemCount * ITEM_HEIGHT) - 8)),
  };
};

const MenuLevel: React.FC<MenuLevelProps> = ({ items, root = false, onClose, onBack }) => {
  const menuWidth = getMenuWidth();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [submenuPlacement, setSubmenuPlacement] = useState<{ side: 'left' | 'right'; top: number }>({
    side: 'right',
    top: 0,
  });
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusItem = (index: number) => {
    const enabled = items.map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.separator && !item.disabled);
    if (enabled.length === 0) return;
    const target = enabled.find(({ itemIndex }) => itemIndex === index) || enabled[0];
    itemRefs.current[target.itemIndex]?.focus();
  };

  useEffect(() => {
    focusItem(0);
  }, []);

  const openItemSubmenu = (itemId: string, button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const submenuIndex = items.findIndex((item) => item.id === itemId);
    const submenuHeight = (items[submenuIndex]?.submenu?.length || 1) * ITEM_HEIGHT;
    setSubmenuPlacement({
      side: rect.right + menuWidth + 8 > window.innerWidth ? 'left' : 'right',
      top: Math.min(0, window.innerHeight - rect.top - submenuHeight - 8),
    });
    setOpenSubmenu(itemId);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const activeIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const start = activeIndex < 0 ? (direction > 0 ? -1 : items.length) : activeIndex;
      for (let offset = 1; offset <= items.length; offset += 1) {
        const index = (start + direction * offset + items.length) % items.length;
        if (!items[index]?.separator && !items[index]?.disabled) {
          itemRefs.current[index]?.focus();
          break;
        }
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusItem(event.key === 'Home' ? 0 : items.length - 1);
    } else if (event.key === 'ArrowRight' && activeIndex >= 0 && items[activeIndex]?.submenu) {
      event.preventDefault();
      event.stopPropagation();
      const button = itemRefs.current[activeIndex];
      if (button) openItemSubmenu(items[activeIndex].id, button);
    } else if (event.key === 'ArrowLeft' && onBack) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    } else if (event.key === 'Escape' && !root && onBack) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    } else if (event.key === 'Escape' && root) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      role="menu"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ width: menuWidth }}
      className="relative rounded border border-[#086375] bg-[#020500] p-1 text-xs font-mono text-[#DDFBD0] shadow-xl outline-none"
    >
      {items.map((item, index) => {
        if (item.separator) return <div key={item.id} role="separator" className="my-1 border-t border-[#086375]/50" />;
        const isOpen = openSubmenu === item.id;
        const canOpenSubmenu = Boolean(item.submenu?.length);
        return (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => {
              const button = itemRefs.current[index];
              if (canOpenSubmenu && !item.disabled && button) openItemSubmenu(item.id, button);
              else setOpenSubmenu(null);
            }}
          >
            <button
              ref={(element) => { itemRefs.current[index] = element; }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.disabledReason : undefined}
              aria-haspopup={canOpenSubmenu ? 'menu' : undefined}
              aria-expanded={canOpenSubmenu ? isOpen : undefined}
              onClick={(event) => {
                if (item.disabled) return;
                if (canOpenSubmenu) {
                  openItemSubmenu(item.id, event.currentTarget);
                  return;
                }
                item.onSelect?.();
                onClose();
              }}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left ${
                item.danger ? 'text-[#FE5F00]' : 'text-[#DDFBD0]'
              } hover:bg-[#086375]/30 hover:text-[#E0CA3C] disabled:cursor-not-allowed disabled:opacity-45`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && <span className="text-hud-2 text-[#DDFBD0]/45">{item.shortcut}</span>}
              {canOpenSubmenu && <span aria-hidden="true">{submenuPlacement.side === 'left' ? '‹' : '›'}</span>}
            </button>
            {isOpen && item.submenu && (
              <div
                className={`absolute z-[10000] ${submenuPlacement.side === 'left' ? 'right-full mr-1' : 'left-full ml-1'}`}
                style={{ top: submenuPlacement.top }}
              >
                <MenuLevel
                  items={item.submenu}
                  onClose={onClose}
                  onBack={() => {
                    setOpenSubmenu(null);
                    itemRefs.current[index]?.focus();
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !portalRef.current?.contains(event.target)) onClose();
    };
    const closeOnBlur = () => onClose();
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('scroll', closeOnBlur, true);
    window.addEventListener('blur', closeOnBlur);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('scroll', closeOnBlur, true);
      window.removeEventListener('blur', closeOnBlur);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={portalRef}
      className="pointer-events-auto fixed z-[9999]"
      style={placeMenu(x, y, items.length)}
    >
      <MenuLevel items={items} root onClose={onClose} />
    </div>,
    document.body,
  );
};
