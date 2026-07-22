"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import type { ExerciseDefinition } from "@/lib/training";

type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type PopupPosition = {
  top: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
};

function useAnchoredPosition(open: boolean, triggerRef: RefObject<HTMLElement | null>, minimumWidth: number, estimatedHeight: number) {
  const [position, setPosition] = useState<PopupPosition>({ top: 0, left: 0, width: minimumWidth, placement: "bottom" });

  useLayoutEffect(() => {
    if (!open) return;

    function update() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(Math.max(rect.width, minimumWidth), window.innerWidth - viewportPadding * 2);
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const useTop = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      setPosition({
        top: useTop ? Math.max(viewportPadding, rect.top - estimatedHeight - 6) : rect.bottom + 6,
        left,
        width,
        placement: useTop ? "top" : "bottom",
      });
    }

    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [estimatedHeight, minimumWidth, open, triggerRef]);

  return position;
}

function useOutsideDismiss(open: boolean, triggerRef: RefObject<HTMLElement | null>, popupRef: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [close, open, popupRef, triggerRef]);
}

function popupStyle(position: PopupPosition): CSSProperties {
  return { top: position.top, left: position.left, width: position.width };
}

export function TrackSelect<T extends string>({ ariaLabel, value, options, onChange, disabled = false }: {
  ariaLabel: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const position = useAnchoredPosition(open, triggerRef, 180, Math.min(280, options.length * 42 + 16));
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useOutsideDismiss(open, triggerRef, popupRef, close);

  function show(direction: 1 | -1 = 1) {
    setActiveIndex(direction === 1 ? selectedIndex : options.length - 1);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show(event.key === "ArrowUp" ? -1 : 1);
      }
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + direction + options.length) % options.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  const selected = options[selectedIndex] ?? options[0];
  const portal = typeof document === "undefined" ? null : createPortal(
    <AnimatePresence>
      {open && <motion.div
        ref={popupRef}
        id={listboxId}
        className={`track-select-menu is-${position.placement}`}
        style={popupStyle(position)}
        role="listbox"
        aria-label={ariaLabel}
        initial={{ opacity: 0, y: position.placement === "bottom" ? -6 : 6, scaleY: .98 }}
        animate={{ opacity: 1, y: 0, scaleY: 1 }}
        exit={{ opacity: 0, y: position.placement === "bottom" ? -4 : 4, scaleY: .985 }}
        transition={{ duration: reduceMotion ? 0 : .18, ease: [0.25, 1, 0.5, 1] }}
      >
        {options.map((option, index) => <button
          id={`${listboxId}-${index}`}
          type="button"
          role="option"
          aria-selected={option.value === value}
          className={`${index === activeIndex ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`.trim()}
          key={option.value}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse") setActiveIndex(index);
          }}
          onClick={() => choose(index)}
        ><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>{option.value === value && <Check size={15} />}</button>)}
      </motion.div>}
    </AnimatePresence>,
    document.body,
  );

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`track-select-trigger ${open ? "is-open" : ""}`.trim()}
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
      disabled={disabled}
      onClick={() => open ? close() : show()}
      onKeyDown={onKeyDown}
    ><span>{selected?.label ?? "请选择"}</span><ChevronDown size={16} /></button>
    {portal}
  </>;
}

function useMobileQuery() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function ExercisePicker({ ariaLabel, value, displayValue, options, onSelect, onCreateCustom }: {
  ariaLabel: string;
  value: string;
  displayValue?: string;
  options: ExerciseDefinition[];
  onSelect: (value: string) => void;
  onCreateCustom: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const listboxId = useId();
  const mobile = useMobileQuery();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const customOption = useMemo<ExerciseDefinition>(() => ({ exerciseId: "custom", name: "自定义动作", equipment: "手动填写", muscleGroup: "", trackingType: "weight_reps", weightMode: "total" }), []);
  const allOptions = useMemo(() => [customOption, ...options], [customOption, options]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    if (!keyword) return allOptions;
    return allOptions.filter((option) => `${option.name} ${option.equipment} ${option.muscleGroup}`.toLocaleLowerCase("zh-CN").includes(keyword));
  }, [allOptions, query]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));
  const selected = options.find((option) => option.exerciseId === value);
  const position = useAnchoredPosition(open && !mobile, triggerRef, 340, 390);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const openPicker = useCallback(() => {
    const selectedIndex = allOptions.findIndex((option) => option.exerciseId === value);
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  }, [allOptions, value]);
  const choose = useCallback((option: ExerciseDefinition) => {
    if (option.exerciseId === "custom") onCreateCustom();
    else onSelect(option.exerciseId);
    close();
  }, [close, onCreateCustom, onSelect]);

  useOutsideDismiss(open && !mobile, triggerRef, popupRef, close);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (filtered.length) setActiveIndex((index) => (index + direction + filtered.length) % filtered.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (filtered.length) setActiveIndex(event.key === "Home" ? 0 : filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[safeActiveIndex];
      if (option) choose(option);
      else onCreateCustom();
    }
  }

  const list = <>
    <div className="exercise-picker-search"><Search size={16} /><input
      ref={searchRef}
      value={query}
      role="combobox"
      aria-label="搜索动作"
      aria-expanded="true"
      aria-controls={listboxId}
      aria-activedescendant={filtered.length ? `${listboxId}-${safeActiveIndex}` : undefined}
      placeholder="搜索动作、器械或肌群"
      onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
      onKeyDown={onSearchKeyDown}
    />{query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={15} /></button>}</div>
    <div id={listboxId} className="exercise-picker-options" role="listbox" aria-label={ariaLabel}>
      {filtered.length ? filtered.map((option, index) => <button
        id={`${listboxId}-${index}`}
        type="button"
        role="option"
        aria-selected={option.exerciseId === value || (option.exerciseId === "custom" && value === "custom")}
        className={`${index === safeActiveIndex ? "is-active" : ""} ${option.exerciseId === value ? "is-selected" : ""}`.trim()}
        key={option.exerciseId}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse") setActiveIndex(index);
        }}
        onClick={() => choose(option)}
      ><span><strong>{option.name}</strong><small>{[option.equipment, option.muscleGroup].filter(Boolean).join(" · ")}</small></span>{option.exerciseId === value && <Check size={16} />}</button>) : <div className="exercise-picker-empty"><strong>没有匹配动作</strong><span>可以换个关键词，或者直接新建。</span><button type="button" onClick={() => { onCreateCustom(); close(); }}>新建自定义动作</button></div>}
    </div>
  </>;

  const portal = typeof document === "undefined" ? null : createPortal(
    <AnimatePresence>
      {open && (mobile ? <motion.div className="exercise-picker-backdrop" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .18 }}>
        <motion.div ref={popupRef} className="exercise-picker-sheet" role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={(event) => event.stopPropagation()} initial={{ y: reduceMotion ? 0 : 24 }} animate={{ y: 0 }} exit={{ y: reduceMotion ? 0 : 18 }} transition={{ duration: reduceMotion ? 0 : .18, ease: [0.25, 1, 0.5, 1] }}>
          <div className="exercise-picker-sheet-header"><span>选择动作</span><button type="button" aria-label="关闭动作选择器" onClick={close}><X size={19} /></button></div>{list}
        </motion.div>
      </motion.div> : <motion.div
        ref={popupRef}
        className={`exercise-picker-menu is-${position.placement}`}
        style={popupStyle(position)}
        initial={{ opacity: 0, y: position.placement === "bottom" ? -6 : 6, scaleY: .98 }}
        animate={{ opacity: 1, y: 0, scaleY: 1 }}
        exit={{ opacity: 0, y: position.placement === "bottom" ? -4 : 4, scaleY: .985 }}
        transition={{ duration: reduceMotion ? 0 : .18, ease: [0.25, 1, 0.5, 1] }}
      >{list}</motion.div>)}
    </AnimatePresence>,
    document.body,
  );

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`exercise-picker-trigger ${open ? "is-open" : ""}`.trim()}
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      onClick={() => open ? close() : openPicker()}
      onKeyDown={(event) => {
        if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          openPicker();
        } else if (open && event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    ><span>{displayValue || selected?.name || "选择动作"}</span><ChevronDown size={16} /></button>
    {portal}
  </>;
}
