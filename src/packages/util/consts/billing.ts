/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const AVG_MONTH_DAYS = 30.5;
export const AVG_YEAR_DAYS = 12 * AVG_MONTH_DAYS;
export const ONE_MONTH_MS = AVG_MONTH_DAYS * ONE_DAY_MS;

// throughout the UI, we show this price as the minimum (per month)
export const LICENSE_MIN_PRICE = "about $6/month";

// Trial Banner in the UI
export const EVALUATION_PERIOD_DAYS = 3;
export const BANNER_NON_DISMISSIBLE_DAYS = 7;
