/* @ds-bundle: {"format":4,"namespace":"ShadcnUiDesignSystem_9d9bee","components":[{"name":"Alert","sourcePath":"components/core/Alert/Alert.jsx"},{"name":"AlertTitle","sourcePath":"components/core/Alert/Alert.jsx"},{"name":"AlertDescription","sourcePath":"components/core/Alert/Alert.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar/Avatar.jsx"},{"name":"AvatarImage","sourcePath":"components/core/Avatar/Avatar.jsx"},{"name":"AvatarFallback","sourcePath":"components/core/Avatar/Avatar.jsx"},{"name":"AvatarGroup","sourcePath":"components/core/Avatar/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardDescription","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardContent","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card/Card.jsx"},{"name":"Checkbox","sourcePath":"components/core/Checkbox/Checkbox.jsx"},{"name":"Dialog","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogTrigger","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogContent","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogHeader","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogFooter","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogTitle","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogDescription","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DialogClose","sourcePath":"components/core/Dialog/Dialog.jsx"},{"name":"DropdownMenu","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"DropdownMenuTrigger","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"DropdownMenuContent","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"DropdownMenuItem","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"DropdownMenuLabel","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"DropdownMenuSeparator","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"DropdownMenuShortcut","sourcePath":"components/core/DropdownMenu/DropdownMenu.jsx"},{"name":"Input","sourcePath":"components/core/Input/Input.jsx"},{"name":"Kbd","sourcePath":"components/core/Kbd/Kbd.jsx"},{"name":"KbdGroup","sourcePath":"components/core/Kbd/Kbd.jsx"},{"name":"Label","sourcePath":"components/core/Label/Label.jsx"},{"name":"Progress","sourcePath":"components/core/Progress/Progress.jsx"},{"name":"RadioGroup","sourcePath":"components/core/RadioGroup/RadioGroup.jsx"},{"name":"RadioGroupItem","sourcePath":"components/core/RadioGroup/RadioGroup.jsx"},{"name":"Select","sourcePath":"components/core/Select/Select.jsx"},{"name":"SelectItem","sourcePath":"components/core/Select/Select.jsx"},{"name":"SelectGroup","sourcePath":"components/core/Select/Select.jsx"},{"name":"Separator","sourcePath":"components/core/Separator/Separator.jsx"},{"name":"Skeleton","sourcePath":"components/core/Skeleton/Skeleton.jsx"},{"name":"Switch","sourcePath":"components/core/Switch/Switch.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs/Tabs.jsx"},{"name":"TabsList","sourcePath":"components/core/Tabs/Tabs.jsx"},{"name":"TabsTrigger","sourcePath":"components/core/Tabs/Tabs.jsx"},{"name":"TabsContent","sourcePath":"components/core/Tabs/Tabs.jsx"},{"name":"Textarea","sourcePath":"components/core/Textarea/Textarea.jsx"},{"name":"TooltipProvider","sourcePath":"components/core/Tooltip/Tooltip.jsx"},{"name":"Tooltip","sourcePath":"components/core/Tooltip/Tooltip.jsx"},{"name":"TooltipTrigger","sourcePath":"components/core/Tooltip/Tooltip.jsx"},{"name":"TooltipContent","sourcePath":"components/core/Tooltip/Tooltip.jsx"}],"sourceHashes":{"components/core/Alert/Alert.jsx":"991800ca47f7","components/core/Avatar/Avatar.jsx":"fc0ad86c0214","components/core/Badge/Badge.jsx":"80f05587c87c","components/core/Button/Button.jsx":"eed5e5799f78","components/core/Card/Card.jsx":"5c53ef5802f8","components/core/Checkbox/Checkbox.jsx":"5134bb565b67","components/core/Dialog/Dialog.jsx":"64906fbbeb3b","components/core/DropdownMenu/DropdownMenu.jsx":"24e4a7f19b8f","components/core/Input/Input.jsx":"37de8fccf584","components/core/Kbd/Kbd.jsx":"1a59cbb986a5","components/core/Label/Label.jsx":"c4dfdf331488","components/core/Progress/Progress.jsx":"9f4d72778693","components/core/RadioGroup/RadioGroup.jsx":"fb8021b4fa98","components/core/Select/Select.jsx":"727fca40946e","components/core/Separator/Separator.jsx":"a4a435cc71d3","components/core/Skeleton/Skeleton.jsx":"08582a2db863","components/core/Switch/Switch.jsx":"7b9b1efee4ed","components/core/Tabs/Tabs.jsx":"88cc85c8aec7","components/core/Textarea/Textarea.jsx":"03743069a41f","components/core/Tooltip/Tooltip.jsx":"e48658951174"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ShadcnUiDesignSystem_9d9bee = window.ShadcnUiDesignSystem_9d9bee || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Alert/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Alert({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "alert",
    className: "sc-alert " + (variant === "destructive" ? "sc-alert--destructive" : "") + " " + className
  }, props), children);
}
function AlertTitle({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-alert-title " + className
  }, props), children);
}
function AlertDescription({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-alert-description " + className
  }, props), children);
}
Object.assign(__ds_scope, { Alert, AlertTitle, AlertDescription });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Alert/Alert.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function Avatar({
  size = "default",
  className = "",
  children,
  ...props
}) {
  const sizeClass = size === "sm" ? "sc-avatar--sm" : size === "lg" ? "sc-avatar--lg" : "";
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-avatar " + sizeClass + " " + className
  }, props), children);
}
function AvatarImage({
  src,
  alt = "",
  onError,
  ...props
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return null;
  return /*#__PURE__*/React.createElement("img", _extends({
    src: src,
    alt: alt,
    onError: () => setFailed(true)
  }, props));
}
function AvatarFallback({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "sc-avatar-fallback " + className
  }, props), children);
}
function AvatarGroup({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-avatar-group " + className
  }, props), children);
}
Object.assign(__ds_scope, { Avatar, AvatarImage, AvatarFallback, AvatarGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  const cls = ["sc-badge", `sc-badge--${variant}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, props), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = "default",
  size = "default",
  className = "",
  children,
  ...props
}) {
  const cls = ["sc-btn", `sc-btn--${variant}`, `sc-btn--size-${size}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls
  }, props), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-card " + className
  }, props), children);
}
function CardHeader({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-card-header " + className
  }, props), children);
}
function CardTitle({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-card-title " + className
  }, props), children);
}
function CardDescription({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-card-description " + className
  }, props), children);
}
function CardContent({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-card-content " + className
  }, props), children);
}
function CardFooter({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-card-footer " + className
  }, props), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Checkbox/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    className: "sc-checkbox " + className
  }, props));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Checkbox/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/core/Dialog/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  createContext,
  useContext
} = React;
const DialogCtx = createContext(null);
function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = open !== undefined ? open : internal;
  function setOpen(v) {
    if (open === undefined) setInternal(v);
    onOpenChange && onOpenChange(v);
  }
  return /*#__PURE__*/React.createElement(DialogCtx.Provider, {
    value: {
      isOpen,
      setOpen
    }
  }, children);
}
function DialogTrigger({
  children,
  asChild,
  ...props
}) {
  const {
    setOpen
  } = useContext(DialogCtx);
  return React.cloneElement(children, {
    onClick: () => setOpen(true),
    ...props
  });
}
function DialogContent({
  className = "",
  children,
  showCloseButton = true,
  ...props
}) {
  const {
    isOpen,
    setOpen
  } = useContext(DialogCtx);
  if (!isOpen) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sc-dialog-overlay",
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dialog-content " + className,
    role: "dialog"
  }, props), children, showCloseButton && /*#__PURE__*/React.createElement("button", {
    className: "sc-dialog-close",
    onClick: () => setOpen(false),
    "aria-label": "Close"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  })))));
}
function DialogHeader({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dialog-header " + className
  }, props), children);
}
function DialogFooter({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dialog-footer " + className
  }, props), children);
}
function DialogTitle({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dialog-title " + className
  }, props), children);
}
function DialogDescription({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dialog-description " + className
  }, props), children);
}
function DialogClose({
  children,
  ...props
}) {
  const {
    setOpen
  } = useContext(DialogCtx);
  return React.cloneElement(children, {
    onClick: () => setOpen(false),
    ...props
  });
}
Object.assign(__ds_scope, { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Dialog/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/core/DropdownMenu/DropdownMenu.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext
} = React;
const MenuCtx = createContext(null);
function DropdownMenu({
  children
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return /*#__PURE__*/React.createElement(MenuCtx.Provider, {
    value: {
      open,
      setOpen
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "relative",
      display: "inline-block"
    }
  }, children));
}
function DropdownMenuTrigger({
  children,
  asChild
}) {
  const {
    open,
    setOpen
  } = useContext(MenuCtx);
  return React.cloneElement(children, {
    onClick: () => setOpen(!open)
  });
}
function DropdownMenuContent({
  className = "",
  children,
  align = "start",
  ...props
}) {
  const {
    open
  } = useContext(MenuCtx);
  if (!open) return null;
  const style = {
    top: "calc(100% + 4px)",
    [align === "end" ? "right" : "left"]: 0
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dropdown-content " + className,
    style: style
  }, props), children);
}
function DropdownMenuItem({
  className = "",
  variant = "default",
  children,
  onClick,
  ...props
}) {
  const {
    setOpen
  } = useContext(MenuCtx);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: "sc-dropdown-item " + (variant === "destructive" ? "sc-dropdown-item--destructive" : "") + " " + className,
    onClick: e => {
      onClick && onClick(e);
      setOpen(false);
    }
  }, props), children);
}
function DropdownMenuLabel({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dropdown-label " + className
  }, props), children);
}
function DropdownMenuSeparator({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-dropdown-separator " + className
  }, props));
}
function DropdownMenuShortcut({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "sc-dropdown-shortcut " + className
  }, props), children);
}
Object.assign(__ds_scope, { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/DropdownMenu/DropdownMenu.jsx", error: String((e && e.message) || e) }); }

// components/core/Input/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    className: "sc-input " + className
  }, props));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Kbd/Kbd.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Kbd({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("kbd", _extends({
    className: "sc-kbd " + className
  }, props), children);
}
function KbdGroup({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "sc-kbd-group " + className
  }, props), children);
}
Object.assign(__ds_scope, { Kbd, KbdGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Kbd/Kbd.jsx", error: String((e && e.message) || e) }); }

// components/core/Label/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Label({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    className: "sc-label " + className
  }, props), children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Label/Label.jsx", error: String((e && e.message) || e) }); }

// components/core/Progress/Progress.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Progress({
  value = 0,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-progress " + className
  }, props), /*#__PURE__*/React.createElement("div", {
    className: "sc-progress-indicator",
    style: {
      transform: `translateX(-${100 - value}%)`
    }
  }));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Progress/Progress.jsx", error: String((e && e.message) || e) }); }

// components/core/RadioGroup/RadioGroup.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function RadioGroup({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "radiogroup",
    className: "sc-radio-group " + className
  }, props), children);
}
function RadioGroupItem({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    className: "sc-radio " + className
  }, props));
}
Object.assign(__ds_scope, { RadioGroup, RadioGroupItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/RadioGroup/RadioGroup.jsx", error: String((e && e.message) || e) }); }

// components/core/Select/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "sc-select-wrap",
    style: {
      position: "relative",
      display: "inline-block",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    className: "sc-select-trigger " + className
  }, props), children), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    style: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      width: 16,
      height: 16,
      opacity: .5,
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })));
}
function SelectItem({
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("option", props, children);
}
function SelectGroup({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("optgroup", {
    label: label
  }, children);
}
Object.assign(__ds_scope, { Select, SelectItem, SelectGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Separator/Separator.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Separator({
  orientation = "horizontal",
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    className: "sc-separator sc-separator--" + orientation + " " + className
  }, props));
}
Object.assign(__ds_scope, { Separator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Separator/Separator.jsx", error: String((e && e.message) || e) }); }

// components/core/Skeleton/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Skeleton({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-skeleton " + className
  }, props));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Skeleton/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  className = "",
  disabled,
  ...props
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = checked !== undefined ? checked : internal;
  function toggle() {
    if (disabled) return;
    const next = !isChecked;
    if (checked === undefined) setInternal(next);
    onCheckedChange && onCheckedChange(next);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": isChecked,
    "data-checked": isChecked,
    disabled: disabled,
    className: "sc-switch " + className,
    onClick: toggle
  }, props), /*#__PURE__*/React.createElement("span", {
    className: "sc-switch-thumb"
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  createContext,
  useContext
} = React;
const TabsCtx = createContext(null);
function Tabs({
  defaultValue,
  value,
  onValueChange,
  className = "",
  children,
  ...props
}) {
  const [internal, setInternal] = useState(defaultValue);
  const active = value !== undefined ? value : internal;
  function setActive(v) {
    if (value === undefined) setInternal(v);
    onValueChange && onValueChange(v);
  }
  return /*#__PURE__*/React.createElement(TabsCtx.Provider, {
    value: {
      active,
      setActive
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-tabs " + className
  }, props), children));
}
function TabsList({
  className = "",
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-tabs-list " + className,
    role: "tablist"
  }, props), children);
}
function TabsTrigger({
  value,
  className = "",
  children,
  ...props
}) {
  const {
    active,
    setActive
  } = useContext(TabsCtx);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "tab",
    "data-active": active === value,
    className: "sc-tabs-trigger " + className,
    onClick: () => setActive(value)
  }, props), children);
}
function TabsContent({
  value,
  className = "",
  children,
  ...props
}) {
  const {
    active
  } = useContext(TabsCtx);
  if (active !== value) return null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "sc-tabs-content " + className
  }, props), children);
}
Object.assign(__ds_scope, { Tabs, TabsList, TabsTrigger, TabsContent });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/core/Textarea/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    className: "sc-textarea " + className
  }, props));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Textarea/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/core/Tooltip/Tooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  createContext,
  useContext
} = React;
const TooltipCtx = createContext(null);
function TooltipProvider({
  children
}) {
  return children;
}
function Tooltip({
  children
}) {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement(TooltipCtx.Provider, {
    value: {
      open,
      setOpen
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, children));
}
function TooltipTrigger({
  children
}) {
  const {
    setOpen
  } = useContext(TooltipCtx);
  return React.cloneElement(children, {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false)
  });
}
function TooltipContent({
  className = "",
  children,
  side = "top",
  ...props
}) {
  const {
    open
  } = useContext(TooltipCtx);
  if (!open) return null;
  const style = side === "top" ? {
    bottom: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)"
  } : {
    top: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "sc-tooltip-content " + className,
    style: style
  }, props), children);
}
Object.assign(__ds_scope, { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tooltip/Tooltip.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.AlertTitle = __ds_scope.AlertTitle;

__ds_ns.AlertDescription = __ds_scope.AlertDescription;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.AvatarImage = __ds_scope.AvatarImage;

__ds_ns.AvatarFallback = __ds_scope.AvatarFallback;

__ds_ns.AvatarGroup = __ds_scope.AvatarGroup;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.DialogTrigger = __ds_scope.DialogTrigger;

__ds_ns.DialogContent = __ds_scope.DialogContent;

__ds_ns.DialogHeader = __ds_scope.DialogHeader;

__ds_ns.DialogFooter = __ds_scope.DialogFooter;

__ds_ns.DialogTitle = __ds_scope.DialogTitle;

__ds_ns.DialogDescription = __ds_scope.DialogDescription;

__ds_ns.DialogClose = __ds_scope.DialogClose;

__ds_ns.DropdownMenu = __ds_scope.DropdownMenu;

__ds_ns.DropdownMenuTrigger = __ds_scope.DropdownMenuTrigger;

__ds_ns.DropdownMenuContent = __ds_scope.DropdownMenuContent;

__ds_ns.DropdownMenuItem = __ds_scope.DropdownMenuItem;

__ds_ns.DropdownMenuLabel = __ds_scope.DropdownMenuLabel;

__ds_ns.DropdownMenuSeparator = __ds_scope.DropdownMenuSeparator;

__ds_ns.DropdownMenuShortcut = __ds_scope.DropdownMenuShortcut;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Kbd = __ds_scope.Kbd;

__ds_ns.KbdGroup = __ds_scope.KbdGroup;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.RadioGroupItem = __ds_scope.RadioGroupItem;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.SelectItem = __ds_scope.SelectItem;

__ds_ns.SelectGroup = __ds_scope.SelectGroup;

__ds_ns.Separator = __ds_scope.Separator;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TabsList = __ds_scope.TabsList;

__ds_ns.TabsTrigger = __ds_scope.TabsTrigger;

__ds_ns.TabsContent = __ds_scope.TabsContent;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.TooltipProvider = __ds_scope.TooltipProvider;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.TooltipTrigger = __ds_scope.TooltipTrigger;

__ds_ns.TooltipContent = __ds_scope.TooltipContent;

})();
