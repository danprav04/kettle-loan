// src/components/CustomizationModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  FiSliders,
  FiX,
  FiCheck,
  FiRotateCcw,
  FiTag,
  FiDollarSign,
  FiPieChart,
  FiActivity,
  FiStar,
  FiZap,
  FiPercent,
  FiArrowUpCircle,
  FiDownload,
  FiClock,
  FiShare2,
  FiAlertTriangle,
  FiUsers,
  FiEdit3,
  FiTrash2,
  FiLayers,
  FiType,
  FiPlus,
  FiMinus,
} from 'react-icons/fi';
import {
  useCustomization,
  CustomizationSettings,
  MIN_GENERAL_FONT_SIZE,
  MAX_GENERAL_FONT_SIZE,
  DEFAULT_GENERAL_FONT_SIZE,
  MIN_LABEL_FONT_SIZE,
  MAX_LABEL_FONT_SIZE,
  getLabelFontSizeStyle,
} from './CustomizationProvider';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPTIONAL_FEATURE_KEYS: Array<keyof Pick<
  CustomizationSettings,
  | 'customPresets'
  | 'premadePresets'
  | 'autoBalance'
  | 'syncTotal'
  | 'currencyConverter'
  | 'detailedBalance'
  | 'roomStats'
  | 'debtSettlementMap'
  | 'exportReports'
  | 'entryEditsHistory'
  | 'entryShareModal'
>> = [
  'customPresets',
  'premadePresets',
  'autoBalance',
  'syncTotal',
  'currencyConverter',
  'detailedBalance',
  'roomStats',
  'debtSettlementMap',
  'exportReports',
  'entryEditsHistory',
  'entryShareModal',
];

type ModalTab = 'labels' | 'fonts' | 'features' | 'developer';

export default function CustomizationModal({ isOpen, onClose }: CustomizationModalProps) {
  const t = useTranslations('Customization');
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('labels');

  const {
    customizations,
    updateCustomization,
    applyProfile,
    resetDefaults,
    resetLabels,
    resetFontSizes,
    resetDevFeatures,
  } = useCustomization();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const isAllActive = OPTIONAL_FEATURE_KEYS.every((k) => customizations[k] === true);
  const isMinimalActive = OPTIONAL_FEATURE_KEYS.every((k) => customizations[k] === false);

  const hasAnyCustomLabel = Boolean(
    customizations.payerListLabel ||
    customizations.beneficiaryListLabel ||
    customizations.balanceTitleLabel ||
    customizations.detailedBalanceLabel ||
    customizations.newEntryTitleLabel ||
    customizations.amountInputLabel ||
    customizations.descriptionInputLabel ||
    customizations.descriptionPlaceholderLabel ||
    customizations.addEntryButtonLabel ||
    customizations.allEntriesButtonLabel ||
    customizations.roomStatsButtonLabel ||
    customizations.quickActionsLabel ||
    customizations.presetsBarLabel ||
    customizations.autoBalanceButtonLabel ||
    customizations.syncTotalButtonLabel
  );

  const hasAnyCustomFontSize = Boolean(
    (customizations.generalFontSize && customizations.generalFontSize !== DEFAULT_GENERAL_FONT_SIZE) ||
    customizations.payerListLabelFontSize ||
    customizations.beneficiaryListLabelFontSize ||
    customizations.balanceTitleLabelFontSize ||
    customizations.detailedBalanceLabelFontSize ||
    customizations.newEntryTitleLabelFontSize ||
    customizations.amountInputLabelFontSize ||
    customizations.descriptionInputLabelFontSize ||
    customizations.descriptionPlaceholderLabelFontSize ||
    customizations.addEntryButtonLabelFontSize ||
    customizations.allEntriesButtonLabelFontSize ||
    customizations.roomStatsButtonLabelFontSize ||
    customizations.quickActionsLabelFontSize ||
    customizations.presetsBarLabelFontSize ||
    customizations.autoBalanceButtonLabelFontSize ||
    customizations.syncTotalButtonLabelFontSize
  );

  const hasAnyDevFeatureDisabled = Boolean(
    !customizations.coreSumBadge ||
    !customizations.coreEntryEditing ||
    !customizations.corePersonSelection ||
    !customizations.coreManualShareInputs ||
    !customizations.coreEnforceSumValidation ||
    !customizations.coreBalanceDisplay ||
    !customizations.coreEntryDeletion
  );

  const labelGroups = [
    {
      title: t('labelsGroupLists'),
      fields: [
        { key: 'payerListLabel' as const, fontSizeKey: 'payerListLabelFontSize' as const, labelKey: 'fromLabelTitle', placeholderKey: 'fromLabelPlaceholder', defaultSizeHint: 13 },
        { key: 'beneficiaryListLabel' as const, fontSizeKey: 'beneficiaryListLabelFontSize' as const, labelKey: 'toLabelTitle', placeholderKey: 'toLabelPlaceholder', defaultSizeHint: 13 },
      ],
    },
    {
      title: t('labelsGroupHeader'),
      fields: [
        { key: 'balanceTitleLabel' as const, fontSizeKey: 'balanceTitleLabelFontSize' as const, labelKey: 'balanceTitleLabelTitle', placeholderKey: 'balanceTitleLabelPlaceholder', defaultSizeHint: 13 },
        { key: 'detailedBalanceLabel' as const, fontSizeKey: 'detailedBalanceLabelFontSize' as const, labelKey: 'detailedBalanceLabelTitle', placeholderKey: 'detailedBalanceLabelPlaceholder', defaultSizeHint: 13 },
      ],
    },
    {
      title: t('labelsGroupForm'),
      fields: [
        { key: 'newEntryTitleLabel' as const, fontSizeKey: 'newEntryTitleLabelFontSize' as const, labelKey: 'newEntryTitleLabelTitle', placeholderKey: 'newEntryTitleLabelPlaceholder', defaultSizeHint: 22 },
        { key: 'amountInputLabel' as const, fontSizeKey: 'amountInputLabelFontSize' as const, labelKey: 'amountInputLabelTitle', placeholderKey: 'amountInputLabelPlaceholder', defaultSizeHint: 13 },
        { key: 'descriptionInputLabel' as const, fontSizeKey: 'descriptionInputLabelFontSize' as const, labelKey: 'descriptionInputLabelTitle', placeholderKey: 'descriptionInputLabelPlaceholder', defaultSizeHint: 13 },
        { key: 'descriptionPlaceholderLabel' as const, fontSizeKey: 'descriptionPlaceholderLabelFontSize' as const, labelKey: 'descriptionPlaceholderLabelTitle', placeholderKey: 'descriptionPlaceholderLabelPlaceholder', defaultSizeHint: 15 },
        { key: 'addEntryButtonLabel' as const, fontSizeKey: 'addEntryButtonLabelFontSize' as const, labelKey: 'addEntryButtonLabelTitle', placeholderKey: 'addEntryButtonLabelPlaceholder', defaultSizeHint: 15 },
      ],
    },
    {
      title: t('labelsGroupPresets'),
      fields: [
        { key: 'quickActionsLabel' as const, fontSizeKey: 'quickActionsLabelFontSize' as const, labelKey: 'quickActionsLabelTitle', placeholderKey: 'quickActionsLabelPlaceholder', defaultSizeHint: 12 },
        { key: 'presetsBarLabel' as const, fontSizeKey: 'presetsBarLabelFontSize' as const, labelKey: 'presetsBarLabelTitle', placeholderKey: 'presetsBarLabelPlaceholder', defaultSizeHint: 12 },
        { key: 'autoBalanceButtonLabel' as const, fontSizeKey: 'autoBalanceButtonLabelFontSize' as const, labelKey: 'autoBalanceButtonLabelTitle', placeholderKey: 'autoBalanceButtonLabelPlaceholder', defaultSizeHint: 11 },
        { key: 'syncTotalButtonLabel' as const, fontSizeKey: 'syncTotalButtonLabelFontSize' as const, labelKey: 'syncTotalButtonLabelTitle', placeholderKey: 'syncTotalButtonLabelPlaceholder', defaultSizeHint: 12 },
      ],
    },
    {
      title: t('labelsGroupNav'),
      fields: [
        { key: 'allEntriesButtonLabel' as const, fontSizeKey: 'allEntriesButtonLabelFontSize' as const, labelKey: 'allEntriesButtonLabelTitle', placeholderKey: 'allEntriesButtonLabelPlaceholder', defaultSizeHint: 15 },
        { key: 'roomStatsButtonLabel' as const, fontSizeKey: 'roomStatsButtonLabelFontSize' as const, labelKey: 'roomStatsButtonLabelTitle', placeholderKey: 'roomStatsButtonLabelPlaceholder', defaultSizeHint: 15 },
      ],
    },
  ];

  const optionalFeatureGroups: Array<{
    category: string;
    items: Array<{
      key: keyof Pick<
        CustomizationSettings,
        | 'customPresets'
        | 'premadePresets'
        | 'autoBalance'
        | 'syncTotal'
        | 'currencyConverter'
        | 'detailedBalance'
        | 'roomStats'
        | 'debtSettlementMap'
        | 'exportReports'
        | 'entryEditsHistory'
        | 'entryShareModal'
      >;
      icon: React.ReactNode;
      title: string;
      description: string;
    }>;
  }> = [
    {
      category: t('categoryPresets'),
      items: [
        {
          key: 'customPresets',
          icon: <FiStar className="text-amber-500" />,
          title: t('customPresets'),
          description: t('customPresetsDesc'),
        },
        {
          key: 'premadePresets',
          icon: <FiZap className="text-blue-500" />,
          title: t('premadePresets'),
          description: t('premadePresetsDesc'),
        },
        {
          key: 'autoBalance',
          icon: <FiPercent className="text-emerald-500" />,
          title: t('autoBalance'),
          description: t('autoBalanceDesc'),
        },
        {
          key: 'syncTotal',
          icon: <FiArrowUpCircle className="text-purple-500" />,
          title: t('syncTotal'),
          description: t('syncTotalDesc'),
        },
      ],
    },
    {
      category: t('categoryCurrencies'),
      items: [
        {
          key: 'currencyConverter',
          icon: <FiDollarSign className="text-emerald-500" />,
          title: t('currencyConverter'),
          description: t('currencyConverterDesc'),
        },
      ],
    },
    {
      category: t('categoryAnalytics'),
      items: [
        {
          key: 'roomStats',
          icon: <FiPieChart className="text-indigo-500" />,
          title: t('roomStats'),
          description: t('roomStatsDesc'),
        },
        {
          key: 'detailedBalance',
          icon: <FiActivity className="text-sky-500" />,
          title: t('detailedBalance'),
          description: t('detailedBalanceDesc'),
        },
        {
          key: 'debtSettlementMap',
          icon: <FiZap className="text-violet-500" />,
          title: t('debtSettlementMap'),
          description: t('debtSettlementMapDesc'),
        },
        {
          key: 'exportReports',
          icon: <FiDownload className="text-teal-500" />,
          title: t('exportReports'),
          description: t('exportReportsDesc'),
        },
      ],
    },
    {
      category: t('categoryActions'),
      items: [
        {
          key: 'entryEditsHistory',
          icon: <FiClock className="text-orange-500" />,
          title: t('entryEditsHistory'),
          description: t('entryEditsHistoryDesc'),
        },
        {
          key: 'entryShareModal',
          icon: <FiShare2 className="text-pink-500" />,
          title: t('entryShareModal'),
          description: t('entryShareModalDesc'),
        },
      ],
    },
  ];

  const coreDeveloperFeatures: Array<{
    key: keyof Pick<
      CustomizationSettings,
      | 'coreSumBadge'
      | 'coreEntryEditing'
      | 'corePersonSelection'
      | 'coreManualShareInputs'
      | 'coreEnforceSumValidation'
      | 'coreBalanceDisplay'
      | 'coreEntryDeletion'
    >;
    icon: React.ReactNode;
    title: string;
    description: string;
    loss: string;
    breaking: string;
  }> = [
    {
      key: 'coreSumBadge',
      icon: <FiCheck className="text-emerald-500" />,
      title: t('coreSumBadgeTitle'),
      description: t('coreSumBadgeDesc'),
      loss: t('coreSumBadgeLoss'),
      breaking: t('coreSumBadgeBreak'),
    },
    {
      key: 'coreEntryEditing',
      icon: <FiEdit3 className="text-blue-500" />,
      title: t('coreEntryEditingTitle'),
      description: t('coreEntryEditingDesc'),
      loss: t('coreEntryEditingLoss'),
      breaking: t('coreEntryEditingBreak'),
    },
    {
      key: 'corePersonSelection',
      icon: <FiUsers className="text-purple-500" />,
      title: t('corePersonSelectionTitle'),
      description: t('corePersonSelectionDesc'),
      loss: t('corePersonSelectionLoss'),
      breaking: t('corePersonSelectionBreak'),
    },
    {
      key: 'coreManualShareInputs',
      icon: <FiDollarSign className="text-amber-500" />,
      title: t('coreManualShareInputsTitle'),
      description: t('coreManualShareInputsDesc'),
      loss: t('coreManualShareInputsLoss'),
      breaking: t('coreManualShareInputsBreak'),
    },
    {
      key: 'coreEnforceSumValidation',
      icon: <FiAlertTriangle className="text-red-500" />,
      title: t('coreEnforceSumValidationTitle'),
      description: t('coreEnforceSumValidationDesc'),
      loss: t('coreEnforceSumValidationLoss'),
      breaking: t('coreEnforceSumValidationBreak'),
    },
    {
      key: 'coreBalanceDisplay',
      icon: <FiLayers className="text-cyan-500" />,
      title: t('coreBalanceDisplayTitle'),
      description: t('coreBalanceDisplayDesc'),
      loss: t('coreBalanceDisplayLoss'),
      breaking: t('coreBalanceDisplayBreak'),
    },
    {
      key: 'coreEntryDeletion',
      icon: <FiTrash2 className="text-rose-500" />,
      title: t('coreEntryDeletionTitle'),
      description: t('coreEntryDeletionDesc'),
      loss: t('coreEntryDeletionLoss'),
      breaking: t('coreEntryDeletionBreak'),
    },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customization-modal-title"
    >
      <div
        className="w-full max-w-2xl bg-card border border-card-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-card-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 sm:p-2.5 rounded-xl bg-primary/20 text-primary shrink-0 border border-primary/30">
              <FiSliders size={22} />
            </span>
            <div>
              <h2 id="customization-modal-title" className="text-lg sm:text-xl font-bold font-heading text-foreground leading-tight">
                {t('title')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {t('subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer font-bold"
            aria-label="Close"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Navigation Tabs - Responsive Segmented Control */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-card-border bg-muted/20 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-muted/60 dark:bg-white/5 rounded-2xl border border-card-border">
            <button
              type="button"
              onClick={() => setActiveTab('labels')}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                activeTab === 'labels'
                  ? 'bg-card text-foreground shadow-sm border border-card-border/60 dark:border-white/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <FiTag size={14} className="shrink-0 text-primary" />
              <span className="truncate">{t('tabLabels')}</span>
              {hasAnyCustomLabel && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fonts')}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                activeTab === 'fonts'
                  ? 'bg-card text-foreground shadow-sm border border-card-border/60 dark:border-white/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <FiType size={14} className="shrink-0 text-indigo-500" />
              <span className="truncate">{t('tabFonts')}</span>
              {hasAnyCustomFontSize && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('features')}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                activeTab === 'features'
                  ? 'bg-card text-foreground shadow-sm border border-card-border/60 dark:border-white/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <FiZap size={14} className="shrink-0 text-amber-500" />
              <span className="truncate">{t('tabFeatures')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('developer')}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                activeTab === 'developer'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
              }`}
            >
              <FiAlertTriangle size={14} className={`shrink-0 ${activeTab === 'developer' ? 'text-white' : 'text-red-500'}`} />
              <span className="truncate">{t('tabDeveloper')}</span>
              {hasAnyDevFeatureDisabled && (
                <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full animate-pulse shrink-0 ${
                  activeTab === 'developer' ? 'bg-white text-red-600' : 'bg-red-500 text-white'
                }`}>
                  !
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">

          {/* TAB 1: ALL LABELS */}
          {activeTab === 'labels' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                    {t('labelsSectionTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('labelsSectionDesc')}
                  </p>
                </div>

                {hasAnyCustomLabel && (
                  <button
                    type="button"
                    onClick={resetLabels}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FiRotateCcw size={13} />
                    <span>{t('resetAllLabels')}</span>
                  </button>
                )}
              </div>

              {labelGroups.map((group) => (
                <div
                  key={group.title}
                  className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-card-border/80 dark:border-white/5 space-y-3.5"
                >
                  <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                    {group.title}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {group.fields.map((field) => {
                      const val = customizations[field.key] as string;
                      const fontSizeVal = customizations[field.fontSizeKey] as number;
                      return (
                        <div key={field.key} className={`space-y-2 p-3 rounded-xl bg-background/50 border border-card-border/60 dark:border-white/5 ${field.key === 'descriptionPlaceholderLabel' ? 'sm:col-span-2' : ''}`}>
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-muted-foreground truncate">
                              {t(field.labelKey as any)}
                            </label>
                            {val && (
                              <button
                                type="button"
                                onClick={() => updateCustomization(field.key, '')}
                                className="text-[11px] text-muted-foreground hover:text-danger cursor-pointer ml-1"
                                title="Clear"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => updateCustomization(field.key, e.target.value)}
                            placeholder={t(field.placeholderKey as any)}
                            maxLength={50}
                            className="w-full themed-input px-3.5 py-2 text-sm rounded-xl border border-input bg-background font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                          <div className="pt-1.5 border-t border-card-border/40 dark:border-white/5 flex items-center justify-between gap-1.5 text-xs flex-wrap">
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <FiType size={12} className="text-primary shrink-0" />
                              <span>{t('fontSizeControlLabel')}:</span>
                              <span className="font-bold text-foreground">
                                {fontSizeVal > 0 ? `${fontSizeVal}px` : t('fontSizeDefault')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = fontSizeVal || field.defaultSizeHint;
                                  if (cur > MIN_LABEL_FONT_SIZE) updateCustomization(field.fontSizeKey, cur - 1);
                                }}
                                disabled={fontSizeVal > 0 && fontSizeVal <= MIN_LABEL_FONT_SIZE}
                                className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer"
                                title="Decrease font size"
                              >
                                <FiMinus size={11} />
                              </button>
                              <input
                                type="range"
                                min={MIN_LABEL_FONT_SIZE}
                                max={MAX_LABEL_FONT_SIZE}
                                step={1}
                                value={fontSizeVal || field.defaultSizeHint}
                                onChange={(e) => updateCustomization(field.fontSizeKey, parseInt(e.target.value, 10))}
                                className="w-16 sm:w-20 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = fontSizeVal || field.defaultSizeHint;
                                  if (cur < MAX_LABEL_FONT_SIZE) updateCustomization(field.fontSizeKey, cur + 1);
                                }}
                                disabled={fontSizeVal >= MAX_LABEL_FONT_SIZE}
                                className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer"
                                title="Increase font size"
                              >
                                <FiPlus size={11} />
                              </button>
                              {fontSizeVal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateCustomization(field.fontSizeKey, 0)}
                                  className="text-[11px] text-muted-foreground hover:text-danger px-1 cursor-pointer font-bold"
                                  title={t('fontSizeDefault')}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: FONT SIZES & TYPOGRAPHY */}
          {activeTab === 'fonts' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header with Reset */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                    {t('tabFonts')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('fontSizeGeneralDesc')}
                  </p>
                </div>

                {hasAnyCustomFontSize && (
                  <button
                    type="button"
                    onClick={resetFontSizes}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FiRotateCcw size={13} />
                    <span>{t('resetFontSizes')}</span>
                  </button>
                )}
              </div>

              {/* 1. General Font Size Hero Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/30 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="p-2 sm:p-2.5 rounded-xl bg-primary/20 text-primary shrink-0 border border-primary/30">
                      <FiType size={20} />
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-foreground">
                        {t('fontSizeGeneralTitle')}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {t('fontSizeGeneralDesc')}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-black border tracking-wide shrink-0 ${
                    customizations.generalFontSize === DEFAULT_GENERAL_FONT_SIZE
                      ? 'bg-muted text-muted-foreground border-card-border'
                      : 'bg-primary/20 text-primary border-primary/40'
                  }`}>
                    {customizations.generalFontSize}px {customizations.generalFontSize === DEFAULT_GENERAL_FONT_SIZE ? `(${t('fontSizeDefault')})` : ''}
                  </span>
                </div>

                {/* Slider and Stepper Controls */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = customizations.generalFontSize || DEFAULT_GENERAL_FONT_SIZE;
                        if (cur > MIN_GENERAL_FONT_SIZE) updateCustomization('generalFontSize', cur - 1);
                      }}
                      disabled={customizations.generalFontSize <= MIN_GENERAL_FONT_SIZE}
                      className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer border border-card-border shadow-sm"
                      title="Decrease"
                    >
                      <FiMinus size={14} />
                    </button>

                    <div className="flex-1 relative flex items-center">
                      <input
                        type="range"
                        min={MIN_GENERAL_FONT_SIZE}
                        max={MAX_GENERAL_FONT_SIZE}
                        step={1}
                        value={customizations.generalFontSize || DEFAULT_GENERAL_FONT_SIZE}
                        onChange={(e) => updateCustomization('generalFontSize', parseInt(e.target.value, 10))}
                        className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const cur = customizations.generalFontSize || DEFAULT_GENERAL_FONT_SIZE;
                        if (cur < MAX_GENERAL_FONT_SIZE) updateCustomization('generalFontSize', cur + 1);
                      }}
                      disabled={customizations.generalFontSize >= MAX_GENERAL_FONT_SIZE}
                      className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer border border-card-border shadow-sm"
                      title="Increase"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>

                  <div className="flex justify-between text-[11px] text-muted-foreground font-semibold px-1">
                    <span>{MIN_GENERAL_FONT_SIZE}px (Compact)</span>
                    <span>{DEFAULT_GENERAL_FONT_SIZE}px (Default)</span>
                    <span>{MAX_GENERAL_FONT_SIZE}px (Max)</span>
                  </div>
                </div>

                {/* Quick Presets Buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {[
                    { label: t('fontSizeCompact'), size: 13 },
                    { label: t('fontSizeStandard'), size: 16 },
                    { label: t('fontSizeLarge'), size: 18 },
                    { label: t('fontSizeExtraLarge'), size: 21 },
                  ].map((preset) => (
                    <button
                      key={preset.size}
                      type="button"
                      onClick={() => updateCustomization('generalFontSize', preset.size)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        customizations.generalFontSize === preset.size
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted hover:bg-muted/80 text-foreground border border-card-border/70'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {customizations.generalFontSize !== DEFAULT_GENERAL_FONT_SIZE && (
                    <button
                      type="button"
                      onClick={() => updateCustomization('generalFontSize', DEFAULT_GENERAL_FONT_SIZE)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer ms-auto flex items-center gap-1"
                    >
                      <FiRotateCcw size={12} />
                      <span>{t('fontSizeDefault')}</span>
                    </button>
                  )}
                </div>

                {/* Live Preview Card */}
                <div className="p-3 sm:p-4 rounded-xl bg-muted/50 border border-card-border/80 dark:border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {t('fontSizePreviewTitle')}
                  </span>
                  <div
                    className="p-3 rounded-lg bg-card border border-card-border/60 text-foreground font-bold shadow-inner"
                    style={{ fontSize: `${customizations.generalFontSize || DEFAULT_GENERAL_FONT_SIZE}px` }}
                  >
                    {t('fontSizePreviewText')}
                  </div>
                </div>
              </div>

              {/* 2. Per-Label Font Sizes List */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                    {t('labelFontSizeSectionTitle')}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('labelFontSizeSectionDesc')}
                  </p>
                </div>

                {labelGroups.map((group) => (
                  <div
                    key={group.title}
                    className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-card-border/80 dark:border-white/5 space-y-3.5"
                  >
                    <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                      {group.title}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {group.fields.map((field) => {
                        const fontSizeVal = customizations[field.fontSizeKey] as number;
                        const customText = customizations[field.key] as string;
                        const displayText = customText?.trim() || t(field.placeholderKey as any);
                        const isCustom = fontSizeVal > 0;

                        return (
                          <div
                            key={field.key}
                            className={`p-3.5 rounded-xl bg-card border border-card-border/70 dark:border-white/10 space-y-2.5 ${
                              field.key === 'descriptionPlaceholderLabel' ? 'sm:col-span-2' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-foreground truncate">
                                {t(field.labelKey as any)}
                              </span>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                  isCustom
                                    ? 'bg-primary/20 text-primary border-primary/30'
                                    : 'bg-muted text-muted-foreground border-card-border/60'
                                }`}>
                                  {isCustom ? `${fontSizeVal}px` : t('fontSizeDefault')}
                                </span>
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => updateCustomization(field.fontSizeKey, 0)}
                                    className="text-[11px] text-muted-foreground hover:text-danger px-1 cursor-pointer font-bold"
                                    title="Reset to default"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Stepper + Slider */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = fontSizeVal || field.defaultSizeHint;
                                  if (cur > MIN_LABEL_FONT_SIZE) updateCustomization(field.fontSizeKey, cur - 1);
                                }}
                                disabled={fontSizeVal > 0 && fontSizeVal <= MIN_LABEL_FONT_SIZE}
                                className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer border border-card-border/60"
                                title="Decrease"
                              >
                                <FiMinus size={12} />
                              </button>

                              <input
                                type="range"
                                min={MIN_LABEL_FONT_SIZE}
                                max={MAX_LABEL_FONT_SIZE}
                                step={1}
                                value={fontSizeVal || field.defaultSizeHint}
                                onChange={(e) => updateCustomization(field.fontSizeKey, parseInt(e.target.value, 10))}
                                className="flex-1 accent-primary h-2 bg-muted rounded-lg cursor-pointer min-w-0"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const cur = fontSizeVal || field.defaultSizeHint;
                                  if (cur < MAX_LABEL_FONT_SIZE) updateCustomization(field.fontSizeKey, cur + 1);
                                }}
                                disabled={fontSizeVal >= MAX_LABEL_FONT_SIZE}
                                className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer border border-card-border/60"
                                title="Increase"
                              >
                                <FiPlus size={12} />
                              </button>
                            </div>

                            {/* Live chip preview */}
                            <div className="pt-1 flex items-center gap-2 overflow-hidden">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">
                                Preview:
                              </span>
                              <div className="truncate min-w-0 flex-1">
                                <span
                                  className="px-2.5 py-0.5 rounded-md bg-muted/80 border border-card-border/80 dark:border-white/10 font-bold inline-block truncate max-w-full"
                                  style={getLabelFontSizeStyle(fontSizeVal)}
                                >
                                  {displayText}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: OPTIONAL FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Quick Profiles Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyProfile('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isAllActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted hover:bg-muted/80 text-foreground border border-card-border'
                  }`}
                >
                  {isAllActive && <FiCheck size={14} className="shrink-0" />}
                  <span>{t('presetAll')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyProfile('minimal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isMinimalActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted hover:bg-muted/80 text-foreground border border-card-border'
                  }`}
                >
                  {isMinimalActive && <FiCheck size={14} className="shrink-0" />}
                  <span>{t('presetMinimal')}</span>
                </button>
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5 ms-auto"
                >
                  <FiRotateCcw size={13} className="shrink-0" />
                  <span>{t('resetDefault')}</span>
                </button>
              </div>

              {/* Feature Groups */}
              {optionalFeatureGroups.map((group) => (
                <div
                  key={group.category}
                  className="p-4 sm:p-5 rounded-2xl bg-card border border-card-border/80 dark:border-white/5 space-y-3"
                >
                  <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                    {group.category}
                  </span>

                  <div className="divide-y divide-card-border/40 dark:divide-white/5">
                    {group.items.map((item) => {
                      const isEnabled = customizations[item.key];
                      return (
                        <div
                          key={item.key}
                          className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-3 sm:gap-4"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                            <span className="mt-0.5 text-base sm:text-lg shrink-0 p-1.5 rounded-lg bg-muted/60 dark:bg-white/5">
                              {item.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs sm:text-sm font-semibold text-foreground block leading-snug">
                                {item.title}
                              </span>
                              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          {/* iOS-style Switch Toggle */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            onClick={() => updateCustomization(item.key, !isEnabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                              isEnabled ? 'bg-primary' : 'bg-muted-foreground/30 dark:bg-zinc-700'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isEnabled
                                  ? 'translate-x-5 rtl:-translate-x-5'
                                  : 'translate-x-0 rtl:translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: DEVELOPER & TESTER ADVANCED */}
          {activeTab === 'developer' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Warning Banner */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-foreground space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="text-amber-500 text-base shrink-0" />
                    <h3 className="font-bold text-xs sm:text-sm tracking-wide text-amber-600 dark:text-amber-400">
                      {t('devSectionBannerTitle')}
                    </h3>
                  </div>

                  {hasAnyDevFeatureDisabled && (
                    <button
                      type="button"
                      onClick={resetDevFeatures}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <FiCheck size={12} />
                      <span>{t('devResetBtn')}</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('devSectionBannerDesc')}
                </p>
              </div>

              {/* Core Feature Switches */}
              <div className="space-y-3.5">
                {coreDeveloperFeatures.map((item) => {
                  const isEnabled = customizations[item.key];
                  const isDangerState = !isEnabled;

                  return (
                    <div
                      key={item.key}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 space-y-3 ${
                        isDangerState
                          ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/40 shadow-sm'
                          : 'bg-card border-card-border/80 dark:border-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                          <span className={`mt-0.5 text-base sm:text-lg shrink-0 p-1.5 rounded-lg ${
                            isDangerState ? 'bg-red-500/20 text-red-400' : 'bg-muted/60 dark:bg-white/5'
                          }`}>
                            {item.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                                {item.title}
                              </span>
                              {isDangerState && (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/30">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-1">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          onClick={() => updateCustomization(item.key, !isEnabled)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                            isEnabled ? 'bg-primary' : 'bg-red-500'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              isEnabled
                                ? 'translate-x-5 rtl:-translate-x-5'
                                : 'translate-x-0 rtl:translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Explicit Warning Card for this core feature */}
                      <div className={`p-3 rounded-xl border text-xs space-y-2.5 transition-colors ${
                        isDangerState
                          ? 'bg-red-500/10 dark:bg-red-500/20 border-red-500/40 text-red-800 dark:text-red-200'
                          : 'bg-muted/40 border-card-border/60 text-muted-foreground'
                      }`}>
                        <div className="space-y-1">
                          <div className="font-bold text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 tracking-wide">
                            <span>⚠️</span>
                            <span>{t('devLossLabel')}</span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-foreground/90 dark:text-foreground/80 leading-relaxed ps-5">
                            {item.loss}
                          </p>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-card-border/40 dark:border-white/5">
                          <div className="font-bold text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5 tracking-wide">
                            <span>💥</span>
                            <span>{t('devBreakLabel')}</span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-foreground/90 dark:text-foreground/80 leading-relaxed ps-5">
                            {item.breaking}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-card-border bg-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl btn-primary font-bold text-sm sm:text-base cursor-pointer shadow-sm transition-transform active:scale-[0.99]"
          >
            {t('done')}
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
