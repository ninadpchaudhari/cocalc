/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { isEqual } from "lodash";

export function cmp(a: any, b: any): number {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  }
  return 0;
}

/*
compare two Date | undefined | null objects.

null and undefined are considered equal to each other.

null_last:
  - true: nulls are infinitely in the future
  - false: nulls are the dawn of mankind
*/

export function cmp_Date(
  a: Date | undefined | null,
  b: Date | undefined | null,
  null_last = false
): number {
  if (a == null) {
    if (b == null) {
      return 0;
    }
    return null_last ? 1 : -1;
  }
  // a != null
  if (b == null) {
    return null_last ? -1 : 1;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0; // note: a == b for Date objects doesn't work as expected, but that's OK here.
}

export function cmp_moment(a?, b?, null_last = false): number {
  return cmp_Date(a?.toDate(), b?.toDate(), null_last);
}

export function cmp_dayjs(a?, b?, null_last = false): number {
  return cmp_Date(a?.toDate(), b?.toDate(), null_last);
}

export function cmp_array(a, b): number {
  const end = Math.max(a.length, b.length);
  for (let i = 0; i < end; i++) {
    const c = cmp(a[i], b[i]);
    if (c) {
      return c;
    }
  }
  return 0;
}

export function timestamp_cmp(a, b, field?: string): number {
  if (field == null) {
    field = "timestamp";
  }
  return -cmp_Date(a[field], b[field]);
}

export function field_cmp(field: string | string[]): (a, b) => number {
  if (typeof field == "string") {
    return (a, b) => cmp(a[field], b[field]);
  } else {
    // array of strings
    return (a, b) => {
      for (const f of field) {
        const c = cmp(a[f], b[f]);
        if (c) return c;
      }
      return 0;
    };
  }
}

export function all_fields_equal<T extends { [K: string]: any }>(
  a: T,
  b: T,
  fields: (keyof T)[],
  verbose?: any
) {
  return !is_different(a, b, fields, verbose);
}

export function is_different<T extends { [K: string]: any }>(
  a: T,
  b: T,
  fields: (keyof T)[],
  verbose?: any
): boolean {
  if (verbose != null) {
    return is_different_verbose(a, b, fields, verbose);
  }
  let field: keyof T;
  if (a == null) {
    if (b == null) {
      return false; // they are the same
    }
    // a not defined but b is
    for (field of fields) {
      if (b[field] != null) {
        return true;
      }
    }
    return false;
  }
  if (b == null) {
    // a is defined or would be handled above
    for (field of fields) {
      if (a[field] != null) {
        return true; // different
      }
    }
    return false; // same
  }

  for (field of fields) {
    if (a[field] !== b[field]) {
      return true;
    }
  }
  return false;
}

// Use for debugging purposes only -- copy code from above to avoid making that
// code more complicated and possibly slower.
function is_different_verbose(a, b, fields, verbose): boolean {
  function log(...x) {
    console.log("is_different_verbose", verbose, ...x);
  }
  let field: string;
  if (a == null) {
    if (b == null) {
      log("both null");
      return false; // they are the same
    }
    // a not defined but b is
    for (field of fields) {
      if (b[field] != null) {
        log("a not defined but b is");
        return true;
      }
    }
    return false;
  }
  if (b == null) {
    // a is defined or would be handled above
    for (field of fields) {
      if (a[field] != null) {
        log(`b null and "${field}" of a is not null`);
        return true; // different
      }
    }
    return false; // same
  }

  for (field of fields) {
    if (a[field] !== b[field]) {
      log(`field "${field}" differs`, a[field], b[field]);
      return true;
    }
  }
  log("same");
  return false;
}

export const is_different_array = (a, b) => !isEqual(a, b);

// See https://stackoverflow.com/questions/22266826/how-can-i-do-a-shallow-comparison-of-the-properties-of-two-objects-with-javascri/22266891#22266891
export const shallowCompare = (obj1, obj2) =>
  Object.keys(obj1).length === Object.keys(obj2).length &&
  Object.keys(obj1).every(
    (key) => obj2.hasOwnProperty(key) && obj1[key] === obj2[key]
  );
