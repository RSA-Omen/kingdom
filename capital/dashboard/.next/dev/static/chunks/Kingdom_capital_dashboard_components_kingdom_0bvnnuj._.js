(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HandAgendaCard",
    ()=>HandAgendaCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
const PRIORITY_EMOJI = {
    P1: "🔴",
    P2: "🟡",
    P3: "🟢",
    IDEA: "💡"
};
function trimMd(s) {
    return s.replace(/\*\*([^*]+)\*\*/g, "$1");
}
function HandAgendaCard() {
    _s();
    const [snap, setSnap] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isPending, startTransition] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    async function refresh() {
        try {
            const r = await fetch("/api/hand/agenda", {
                cache: "no-store"
            });
            if (!r.ok) {
                const e = await r.json().catch(()=>({}));
                setError(e.error ?? `HTTP ${r.status}`);
                return;
            }
            setSnap(await r.json());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HandAgendaCard.useEffect": ()=>{
            refresh();
            const t = setInterval(refresh, 60_000); // poll every minute
            return ({
                "HandAgendaCard.useEffect": ()=>clearInterval(t)
            })["HandAgendaCard.useEffect"];
        }
    }["HandAgendaCard.useEffect"], []);
    async function act(payload) {
        startTransition(async ()=>{
            await fetch("/api/hand/act", {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            await refresh();
        });
    }
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                    subtitle: "Could not reach The Hand."
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                    lineNumber: 83,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-xs text-[var(--color-danger)]",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                    lineNumber: 84,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
            lineNumber: 82,
            columnNumber: 7
        }, this);
    }
    if (!snap) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "Reading the realm's ledger…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 92,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
            lineNumber: 91,
            columnNumber: 7
        }, this);
    }
    const { summary, today, generated_at } = snap.agenda;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "surface p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: `The Hand has read the ledger. ${summary.total_open} matters open across the realm.`
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "🔴",
                        label: "P1",
                        value: summary.p1_count
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                        lineNumber: 106,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "🟡",
                        label: "P2",
                        value: summary.p2_count
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                        lineNumber: 107,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "🟢",
                        label: "P3",
                        value: summary.p3_count
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                        lineNumber: 108,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "💡",
                        label: "Ideas",
                        value: summary.ideas
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                        lineNumber: 109,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 105,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "mt-6 text-sm font-semibold text-[var(--color-text-primary)]",
                children: "Today's three matters"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, this),
            today.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-3 text-sm text-[var(--color-text-secondary)] italic",
                children: "The realm is at peace, Sire. No matters demand attention."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 117,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "mt-3 space-y-3",
                children: today.map((m, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "border border-[var(--color-border)] rounded p-3 flex flex-col sm:flex-row sm:items-start gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-baseline gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-xs text-[var(--color-text-tertiary)] tabular-nums",
                                                children: [
                                                    idx + 1,
                                                    "."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                                lineNumber: 129,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-base",
                                                children: PRIORITY_EMOJI[m.priority ?? ""] ?? "⚪"
                                            }, void 0, false, {
                                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                                lineNumber: 132,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm font-medium text-[var(--color-text-primary)] leading-snug",
                                                children: trimMd(m.title)
                                            }, void 0, false, {
                                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                                lineNumber: 135,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                        lineNumber: 128,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 ml-7 text-xs text-[var(--color-text-tertiary)]",
                                        children: [
                                            m.section,
                                            " · id ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                                                children: m.id
                                            }, void 0, false, {
                                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                                lineNumber: 140,
                                                columnNumber: 36
                                            }, this),
                                            m.deferred_count > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    " · deferred ",
                                                    m.deferred_count,
                                                    "×"
                                                ]
                                            }, void 0, true),
                                            m.overdue && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-2 text-[var(--color-danger)] font-medium",
                                                children: "overdue"
                                            }, void 0, false, {
                                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                                lineNumber: 145,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                        lineNumber: 139,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                lineNumber: 127,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-2 sm:flex-col sm:items-stretch",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionButton, {
                                        disabled: isPending,
                                        onClick: ()=>act({
                                                action: "done",
                                                id: m.id
                                            }),
                                        variant: "primary",
                                        children: "Done"
                                    }, void 0, false, {
                                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                        lineNumber: 153,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionButton, {
                                        disabled: isPending,
                                        onClick: ()=>act({
                                                action: "defer",
                                                id: m.id,
                                                days: 3
                                            }),
                                        variant: "ghost",
                                        children: "Defer 3d"
                                    }, void 0, false, {
                                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                        lineNumber: 160,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                                lineNumber: 152,
                                columnNumber: 15
                            }, this)
                        ]
                    }, m.id, true, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                        lineNumber: 123,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 121,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-5 text-[10px] text-[var(--color-text-tertiary)]",
                children: [
                    "Last brief composed",
                    " ",
                    new Date(generated_at).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short"
                    }),
                    " ",
                    "· — The Hand"
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 173,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_s(HandAgendaCard, "fGLGxGkhLvS/pfey94h8B9EDBgs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c = HandAgendaCard;
function Header({ subtitle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium",
                children: "The Hand of the King says…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 188,
                columnNumber: 7
            }, this),
            subtitle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-sm text-[var(--color-text-secondary)]",
                children: subtitle
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 192,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
        lineNumber: 187,
        columnNumber: 5
    }, this);
}
_c1 = Header;
function Stat({ emoji, label, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "border border-[var(--color-border)] rounded p-2 text-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-base",
                children: emoji
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 209,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]",
                children: value
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 210,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]",
                children: label
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
                lineNumber: 213,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
        lineNumber: 208,
        columnNumber: 5
    }, this);
}
_c2 = Stat;
function ActionButton({ children, onClick, disabled, variant }) {
    const base = "px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const styles = {
        primary: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]",
        ghost: "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] border border-[var(--color-border)]"
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        disabled: disabled,
        onClick: onClick,
        className: `${base} ${styles[variant]}`,
        children: children
    }, void 0, false, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/HandAgendaCard.tsx",
        lineNumber: 240,
        columnNumber: 5
    }, this);
}
_c3 = ActionButton;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "HandAgendaCard");
__turbopack_context__.k.register(_c1, "Header");
__turbopack_context__.k.register(_c2, "Stat");
__turbopack_context__.k.register(_c3, "ActionButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MaesterCard",
    ()=>MaesterCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function MaesterCard() {
    _s();
    const [stats, setStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    async function refresh() {
        try {
            const r = await fetch("/api/maester/stats", {
                cache: "no-store"
            });
            if (!r.ok) {
                const e = await r.json().catch(()=>({}));
                setError(e.error ?? `HTTP ${r.status}`);
                return;
            }
            setStats(await r.json());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MaesterCard.useEffect": ()=>{
            refresh();
            const t = setInterval(refresh, 5 * 60 * 1000); // poll every 5 minutes
            return ({
                "MaesterCard.useEffect": ()=>clearInterval(t)
            })["MaesterCard.useEffect"];
        }
    }["MaesterCard.useEffect"], []);
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                    subtitle: "Could not reach The Maester."
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                    lineNumber: 48,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-xs text-[var(--color-danger)]",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
            lineNumber: 47,
            columnNumber: 7
        }, this);
    }
    if (!stats) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "Reading the realm's books…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 57,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
            lineNumber: 56,
            columnNumber: 7
        }, this);
    }
    const { summary, recent_activity } = stats;
    const daysStale = 30;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "surface p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "The Maester has indexed the realm."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        icon: "📚",
                        label: "Projects",
                        value: summary.total_projects
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                        lineNumber: 70,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        icon: "🌳",
                        label: "Repos",
                        value: summary.total_repos
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                        lineNumber: 75,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        icon: "😴",
                        label: `Stale (>${daysStale}d)`,
                        value: summary.stale_count
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        icon: "📦",
                        label: "Apps",
                        value: summary.by_type.app || 0
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "mt-6 text-sm font-semibold text-[var(--color-text-primary)]",
                children: "Recently Active"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 92,
                columnNumber: 7
            }, this),
            recent_activity.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-3 text-sm text-[var(--color-text-secondary)] italic",
                children: "No recent activity."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 97,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "mt-3 space-y-2",
                children: recent_activity.map((item)=>{
                    const days = item.last_activity ? Math.floor((Date.now() - new Date(item.last_activity).getTime()) / (24 * 60 * 60 * 1000)) : null;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "flex items-center justify-between text-sm border border-[var(--color-border)] rounded p-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs font-medium text-[var(--color-text-primary)]",
                                    children: item.name
                                }, void 0, false, {
                                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                                    lineNumber: 115,
                                    columnNumber: 19
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[10px] text-[var(--color-text-tertiary)]",
                                    children: [
                                        item.type,
                                        days !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                " ",
                                                "· ",
                                                days === 0 ? "today" : `${days}d ago`
                                            ]
                                        }, void 0, true)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                                    lineNumber: 118,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                            lineNumber: 114,
                            columnNumber: 17
                        }, this)
                    }, item.name, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                        lineNumber: 110,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 101,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-5 text-[10px] text-[var(--color-text-tertiary)]",
                children: [
                    "Last indexed",
                    " ",
                    new Date(stats.timestamp).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short"
                    }),
                    " ",
                    "· — The Maester"
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 134,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
_s(MaesterCard, "xQX4Pq+UCR1Zm4y2jekjIJWAJJ0=");
_c = MaesterCard;
function Header({ subtitle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium",
                children: "The Maester says…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 149,
                columnNumber: 7
            }, this),
            subtitle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-sm text-[var(--color-text-secondary)]",
                children: subtitle
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 153,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
        lineNumber: 148,
        columnNumber: 5
    }, this);
}
_c1 = Header;
function Stat({ icon, label, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "border border-[var(--color-border)] rounded p-2 text-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-base",
                children: icon
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 170,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]",
                children: value
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 171,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]",
                children: label
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
                lineNumber: 174,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MaesterCard.tsx",
        lineNumber: 169,
        columnNumber: 5
    }, this);
}
_c2 = Stat;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "MaesterCard");
__turbopack_context__.k.register(_c1, "Header");
__turbopack_context__.k.register(_c2, "Stat");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SearchMaester",
    ()=>SearchMaester
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function SearchMaester() {
    _s();
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [answer, setAnswer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    async function ask() {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setAnswer(null);
        try {
            const r = await fetch("/api/maester/ask", {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    question: query
                })
            });
            if (!r.ok) {
                const e = await r.json().catch(()=>({}));
                setError(e.error ?? `HTTP ${r.status}`);
                return;
            }
            const data = await r.json();
            setAnswer(data.answer);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally{
            setLoading(false);
        }
    }
    const handleKeyDown = (e)=>{
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask();
        }
    };
    const suggestions = [
        "What apps do we have?",
        "What's new?",
        "What's stale?",
        "How many projects?"
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "surface p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium",
                        children: "Ask The Maester"
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "mt-2 text-lg font-semibold text-[var(--color-text-primary)]",
                        children: "Search the realm's memory"
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                        lineNumber: 61,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 flex flex-col gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                ref: inputRef,
                                type: "text",
                                placeholder: "What apps do we have? What's new? What's stale?",
                                value: query,
                                onChange: (e)=>setQuery(e.target.value),
                                onKeyDown: handleKeyDown,
                                disabled: loading,
                                className: "flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                                lineNumber: 68,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ask,
                                disabled: loading || !query.trim(),
                                className: "px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                                children: loading ? "…" : "Ask"
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                                lineNumber: 78,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                        lineNumber: 67,
                        columnNumber: 9
                    }, this),
                    !answer && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-2 text-xs",
                        children: suggestions.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>{
                                    setQuery(s);
                                    setTimeout(()=>inputRef.current?.focus(), 0);
                                },
                                className: "px-2 py-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors",
                                children: s
                            }, s, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                                lineNumber: 90,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                        lineNumber: 88,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                lineNumber: 66,
                columnNumber: 7
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-400",
                children: error
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                lineNumber: 106,
                columnNumber: 9
            }, this),
            answer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 p-4 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-[var(--color-text-tertiary)] mb-2",
                        children: "The Maester's answer:"
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                        lineNumber: 113,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "prose prose-sm dark:prose-invert max-w-none text-sm text-[var(--color-text-primary)] whitespace-pre-wrap font-mono text-xs leading-relaxed",
                        children: answer
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                        lineNumber: 114,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
                lineNumber: 112,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/SearchMaester.tsx",
        lineNumber: 56,
        columnNumber: 5
    }, this);
}
_s(SearchMaester, "RlhsKUITvpP1FUPZzOy/KQn71z4=");
_c = SearchMaester;
var _c;
__turbopack_context__.k.register(_c, "SearchMaester");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BureauCard",
    ()=>BureauCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function BureauCard() {
    _s();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    async function refresh() {
        try {
            const r = await fetch("/api/bureau/briefing", {
                cache: "no-store"
            });
            if (!r.ok) {
                const e = await r.json().catch(()=>({}));
                setError(e.error ?? `HTTP ${r.status}`);
                return;
            }
            setData(await r.json());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BureauCard.useEffect": ()=>{
            refresh();
            const t = setInterval(refresh, 2 * 60 * 1000); // poll every 2 minutes
            return ({
                "BureauCard.useEffect": ()=>clearInterval(t)
            })["BureauCard.useEffect"];
        }
    }["BureauCard.useEffect"], []);
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                    subtitle: "Could not reach The Bureau."
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                    lineNumber: 56,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-xs text-[var(--color-danger)]",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                    lineNumber: 57,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
            lineNumber: 55,
            columnNumber: 7
        }, this);
    }
    if (!data) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "Checking the Bureau systems…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 65,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
            lineNumber: 64,
            columnNumber: 7
        }, this);
    }
    const { health, systems, gkgpu } = data;
    const healthColor = health.healthPercent >= 80 ? "text-emerald-600 dark:text-emerald-400" : health.healthPercent >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "surface p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "The Bureau monitors the villages."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 80,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-4 gap-3 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "✅",
                        label: "Healthy",
                        value: health.healthy
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 83,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "⚠️",
                        label: "Unhealthy",
                        value: health.unhealthy
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 84,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                        emoji: "❓",
                        label: "Unknown",
                        value: health.unknown
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "border border-[var(--color-border)] rounded p-2 text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: `text-base font-semibold tabular-nums ${healthColor}`,
                                children: [
                                    health.healthPercent,
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                                lineNumber: 87,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]",
                                children: "Health"
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 86,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "mt-6 text-sm font-semibold text-[var(--color-text-primary)]",
                children: "Systems"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 96,
                columnNumber: 7
            }, this),
            systems.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-3 text-sm text-[var(--color-text-secondary)] italic",
                children: "No systems registered."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 101,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "mt-3 space-y-2",
                children: systems.map((sys)=>{
                    const icon = sys.status === "healthy" ? "✅" : sys.status === "unhealthy" ? "❌" : "❓";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "flex items-center justify-between text-sm border border-[var(--color-border)] rounded p-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2 flex-1 min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-base",
                                    children: icon
                                }, void 0, false, {
                                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                                    lineNumber: 119,
                                    columnNumber: 19
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex-1 min-w-0",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs font-medium text-[var(--color-text-primary)]",
                                            children: sys.name
                                        }, void 0, false, {
                                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                                            lineNumber: 121,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[10px] text-[var(--color-text-tertiary)]",
                                            children: [
                                                sys.category,
                                                sys.lastCheck && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        " ",
                                                        "· ",
                                                        new Date(sys.lastCheck).toLocaleString("en-GB", {
                                                            dateStyle: "short",
                                                            timeStyle: "short"
                                                        })
                                                    ]
                                                }, void 0, true)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                                            lineNumber: 124,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                                    lineNumber: 120,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                            lineNumber: 118,
                            columnNumber: 17
                        }, this)
                    }, sys.slug, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 114,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 105,
                columnNumber: 9
            }, this),
            !gkgpu.reachable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-medium text-red-700 dark:text-red-400",
                        children: "AI Server Unreachable"
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 146,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-red-600 dark:text-red-500 mt-1",
                        children: gkgpu.error || "The GKGPU server is not responding."
                    }, void 0, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                        lineNumber: 149,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 145,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-5 text-[10px] text-[var(--color-text-tertiary)]",
                children: [
                    "Last check:",
                    " ",
                    new Date(data.timestamp).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short"
                    }),
                    " ",
                    "· — The Bureau"
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 155,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
        lineNumber: 79,
        columnNumber: 5
    }, this);
}
_s(BureauCard, "XDVXnHzsKW9JpOo48THjIq2+NOI=");
_c = BureauCard;
function Header({ subtitle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium",
                children: "The Bureau says…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 170,
                columnNumber: 7
            }, this),
            subtitle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-sm text-[var(--color-text-secondary)]",
                children: subtitle
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 174,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
        lineNumber: 169,
        columnNumber: 5
    }, this);
}
_c1 = Header;
function Stat({ emoji, label, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "border border-[var(--color-border)] rounded p-2 text-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-base",
                children: emoji
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 191,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]",
                children: value
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 192,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]",
                children: label
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
                lineNumber: 195,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/BureauCard.tsx",
        lineNumber: 190,
        columnNumber: 5
    }, this);
}
_c2 = Stat;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "BureauCard");
__turbopack_context__.k.register(_c1, "Header");
__turbopack_context__.k.register(_c2, "Stat");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MasterOfWorksCard",
    ()=>MasterOfWorksCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Kingdom/capital/dashboard/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function MasterOfWorksCard() {
    _s();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    async function refresh() {
        try {
            const r = await fetch("/api/master-of-works/briefing", {
                cache: "no-store"
            });
            if (!r.ok) {
                const e = await r.json().catch(()=>({}));
                setError(e.error ?? `HTTP ${r.status}`);
                return;
            }
            setData(await r.json());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MasterOfWorksCard.useEffect": ()=>{
            refresh();
            const t = setInterval(refresh, 5 * 60 * 1000);
            return ({
                "MasterOfWorksCard.useEffect": ()=>clearInterval(t)
            })["MasterOfWorksCard.useEffect"];
        }
    }["MasterOfWorksCard.useEffect"], []);
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                    subtitle: "Could not reach The Master of Works."
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                    lineNumber: 57,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-xs text-[var(--color-danger)]",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                    lineNumber: 58,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
            lineNumber: 56,
            columnNumber: 7
        }, this);
    }
    if (!data) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "surface p-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "Checking infrastructure…"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 66,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
            lineNumber: 65,
            columnNumber: 7
        }, this);
    }
    const { resources, services } = data;
    const healthyServices = services.filter((s)=>s.isHealthy).length;
    const totalServices = services.length;
    const healthPercent = totalServices > 0 ? Math.round(healthyServices / totalServices * 100) : 0;
    const getResourceColor = (value, warn, crit)=>{
        if (value === undefined) return "text-[var(--color-text-secondary)]";
        if (value >= crit) return "text-red-600 dark:text-red-400";
        if (value >= warn) return "text-amber-600 dark:text-amber-400";
        return "text-emerald-600 dark:text-emerald-400";
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "surface p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Header, {
                subtitle: "The Master of Works monitors the castle."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            resources && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs",
                        children: [
                            resources.cpu !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResourceStat, {
                                emoji: "⚙️",
                                label: "CPU",
                                value: resources.cpu,
                                percent: true,
                                color: getResourceColor(resources.cpu, 80, 95)
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                lineNumber: 92,
                                columnNumber: 15
                            }, this),
                            resources.memory !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResourceStat, {
                                emoji: "💾",
                                label: "Memory",
                                value: resources.memory,
                                percent: true,
                                color: getResourceColor(resources.memory, 80, 95)
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                lineNumber: 101,
                                columnNumber: 15
                            }, this),
                            resources.disk !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResourceStat, {
                                emoji: "💿",
                                label: "Disk",
                                value: resources.disk,
                                percent: true,
                                color: getResourceColor(resources.disk, 80, 90)
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                lineNumber: 110,
                                columnNumber: 15
                            }, this),
                            resources.gpu !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResourceStat, {
                                emoji: "🎮",
                                label: "GPU",
                                value: resources.gpu,
                                percent: true,
                                color: getResourceColor(resources.gpu, 85, 95)
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                lineNumber: 119,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                        lineNumber: 90,
                        columnNumber: 11
                    }, this),
                    resources.load && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 p-3 border border-[var(--color-border)] rounded text-xs",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]",
                                children: "Load Average"
                            }, void 0, false, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                lineNumber: 131,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 font-mono text-[var(--color-text-primary)]",
                                children: [
                                    resources.load.one.toFixed(2),
                                    " ",
                                    resources.load.five.toFixed(2),
                                    " ",
                                    resources.load.fifteen.toFixed(2)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                lineNumber: 134,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                        lineNumber: 130,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "mt-6 text-sm font-semibold text-[var(--color-text-primary)]",
                children: [
                    "Services (",
                    healthyServices,
                    "/",
                    totalServices,
                    ")"
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 143,
                columnNumber: 7
            }, this),
            services.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-3 text-sm text-[var(--color-text-secondary)] italic",
                children: "No services checked."
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 148,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "mt-3 space-y-2",
                children: services.map((service)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "flex items-center justify-between text-sm border border-[var(--color-border)] rounded p-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-base",
                                    children: service.emoji
                                }, void 0, false, {
                                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                    lineNumber: 159,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs font-medium text-[var(--color-text-primary)]",
                                            children: service.name
                                        }, void 0, false, {
                                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                            lineNumber: 161,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[10px] text-[var(--color-text-tertiary)]",
                                            children: service.status
                                        }, void 0, false, {
                                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                            lineNumber: 164,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                                    lineNumber: 160,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                            lineNumber: 158,
                            columnNumber: 15
                        }, this)
                    }, service.name, false, {
                        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                        lineNumber: 154,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 152,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-5 text-[10px] text-[var(--color-text-tertiary)]",
                children: [
                    "Last check:",
                    " ",
                    new Date(data.timestamp).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short"
                    }),
                    " ",
                    "· — The Master of Works"
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 174,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
_s(MasterOfWorksCard, "XDVXnHzsKW9JpOo48THjIq2+NOI=");
_c = MasterOfWorksCard;
function Header({ subtitle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium",
                children: "The Castle Status"
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 189,
                columnNumber: 7
            }, this),
            subtitle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-sm text-[var(--color-text-secondary)]",
                children: subtitle
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 193,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
        lineNumber: 188,
        columnNumber: 5
    }, this);
}
_c1 = Header;
function ResourceStat({ emoji, label, value, percent, color }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "border border-[var(--color-border)] rounded p-2 text-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-base",
                children: emoji
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 216,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: `mt-1 text-lg font-semibold tabular-nums ${color}`,
                children: [
                    value.toFixed(1),
                    percent ? "%" : ""
                ]
            }, void 0, true, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 217,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Kingdom$2f$capital$2f$dashboard$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]",
                children: label
            }, void 0, false, {
                fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
                lineNumber: 221,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Kingdom/capital/dashboard/components/kingdom/MasterOfWorksCard.tsx",
        lineNumber: 215,
        columnNumber: 5
    }, this);
}
_c2 = ResourceStat;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "MasterOfWorksCard");
__turbopack_context__.k.register(_c1, "Header");
__turbopack_context__.k.register(_c2, "ResourceStat");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=Kingdom_capital_dashboard_components_kingdom_0bvnnuj._.js.map