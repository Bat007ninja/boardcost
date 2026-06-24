/**
 * BoardCost — core cost calculation engine.
 *
 * All functions in this module are pure (no DOM access, no side effects)
 * so they can be unit tested with Jest in Node and reused by the browser UI.
 *
 * All rates are INDICATIVE estimating rates for corrugated POS display work,
 * not live supplier pricing. They live in one place (the tables below) so
 * they can be updated without touching any calculation logic.
 */

// ---------------------------------------------------------------------------
// Rate tables
// ---------------------------------------------------------------------------

const BOARD_GRADES = {
  'e-flute': { label: 'E-flute (1.5mm)', costPerM2: 0.85 },
  'b-flute': { label: 'B-flute (3mm)', costPerM2: 0.72 },
  'eb-flute': { label: 'EB double wall (4.5mm)', costPerM2: 1.1 },
  'bc-flute': { label: 'BC double wall (6mm)', costPerM2: 1.25 },
};

/**
 * areaFactor converts the unit's bounding faces into an approximate flat
 * blank area, accounting for shelves, tabs, glue flaps and internal fitments
 * typical of each display format. Derived from measuring past cutter guides.
 * assemblyCostPerUnit covers gluing / hand-assembly labour.
 */
const DISPLAY_TYPES = {
  fsdu: { label: 'FSDU (free-standing display unit)', areaFactor: 3.2, assemblyCostPerUnit: 1.4 },
  cdu: { label: 'CDU (counter display unit)', areaFactor: 2.4, assemblyCostPerUnit: 0.9 },
  standee: { label: 'Standee', areaFactor: 1.6, assemblyCostPerUnit: 0.45 },
  'dump-bin': { label: 'Dump bin', areaFactor: 2.8, assemblyCostPerUnit: 1.1 },
};

const PRINT_PROCESSES = {
  digital: { label: 'Digital', setupCost: 45, costPerM2: 4.5 },
  'litho-lam': { label: 'Litho-laminated', setupCost: 350, costPerM2: 2.2 },
  flexo: { label: 'Direct flexo', setupCost: 180, costPerM2: 1.1 },
};

const LAMINATION = {
  none: { label: 'None', costPerM2: 0 },
  'gloss-lam': { label: 'Gloss lamination', costPerM2: 0.55 },
  'matt-lam': { label: 'Matt lamination', costPerM2: 0.6 },
};

const DIE_CUTTING = { setupCost: 120, costPerUnit: 0.08 };

const WASTE_FACTOR = 1.12; // 12% board waste (trim, make-ready, spoilage)
const MARGIN_RATE = 0.35; // standard markup on production cost
const VAT_RATE = 0.2;

const MAX_DIMENSION_MM = 2400; // largest blank we can practically handle
const MIN_DIMENSION_MM = 50;

/** Quantity discount tiers, checked from largest down. */
const QUANTITY_DISCOUNTS = [
  { minQty: 1000, rate: 0.15 },
  { minQty: 500, rate: 0.12 },
  { minQty: 250, rate: 0.08 },
  { minQty: 100, rate: 0.05 },
  { minQty: 50, rate: 0.03 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places for money, avoiding float drift. */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a quote specification. Throws an Error with a human-readable
 * message on the first problem found. Returns the spec if valid.
 */
function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('No specification provided.');
  }
  const { displayType, boardGrade, printProcess, lamination = 'none' } = spec;

  if (!DISPLAY_TYPES[displayType]) {
    throw new Error(`Unknown display type: "${displayType}".`);
  }
  if (!BOARD_GRADES[boardGrade]) {
    throw new Error(`Unknown board grade: "${boardGrade}".`);
  }
  if (!PRINT_PROCESSES[printProcess]) {
    throw new Error(`Unknown print process: "${printProcess}".`);
  }
  if (!LAMINATION[lamination]) {
    throw new Error(`Unknown lamination option: "${lamination}".`);
  }

  for (const dim of ['widthMm', 'heightMm', 'depthMm']) {
    const value = spec[dim];
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${dim} must be a positive number.`);
    }
    if (value < MIN_DIMENSION_MM) {
      throw new Error(`${dim} is below the ${MIN_DIMENSION_MM}mm minimum.`);
    }
    if (value > MAX_DIMENSION_MM) {
      throw new Error(`${dim} exceeds the ${MAX_DIMENSION_MM}mm maximum.`);
    }
  }

  if (!Number.isInteger(spec.quantity) || spec.quantity < 1) {
    throw new Error('quantity must be a whole number of at least 1.');
  }
  if (spec.quantity > 100000) {
    throw new Error('quantity exceeds the 100,000 unit estimating limit.');
  }

  return spec;
}

// ---------------------------------------------------------------------------
// Calculation steps
// ---------------------------------------------------------------------------

/**
 * Approximate flat blank area per unit, in m², including waste.
 * Uses the three bounding faces (front, side, top) scaled by the display
 * type's areaFactor, then applies the standard waste factor.
 */
function calculateBlankArea({ widthMm, heightMm, depthMm, displayType }) {
  const type = DISPLAY_TYPES[displayType];
  if (!type) {
    throw new Error(`Unknown display type: "${displayType}".`);
  }
  const faceAreaM2 = (widthMm * heightMm + depthMm * heightMm + widthMm * depthMm) / 1e6;
  return faceAreaM2 * type.areaFactor * WASTE_FACTOR;
}

/** Board cost per unit for a given blank area (m²) and grade. */
function materialCostPerUnit(areaM2, boardGrade) {
  const grade = BOARD_GRADES[boardGrade];
  if (!grade) {
    throw new Error(`Unknown board grade: "${boardGrade}".`);
  }
  return areaM2 * grade.costPerM2;
}

/**
 * Total print cost for the run: one-off setup (plates / make-ready)
 * plus a per-m² running cost across all units.
 */
function calculatePrintCost(areaM2, printProcess, quantity) {
  const process = PRINT_PROCESSES[printProcess];
  if (!process) {
    throw new Error(`Unknown print process: "${printProcess}".`);
  }
  return {
    setup: process.setupCost,
    run: areaM2 * process.costPerM2 * quantity,
    total: process.setupCost + areaM2 * process.costPerM2 * quantity,
  };
}

/** Total finishing cost for the run (lamination + optional die-cutting). */
function calculateFinishingCost(areaM2, lamination, dieCut, quantity) {
  const lam = LAMINATION[lamination];
  if (!lam) {
    throw new Error(`Unknown lamination option: "${lamination}".`);
  }
  const laminationCost = areaM2 * lam.costPerM2 * quantity;
  const dieCutCost = dieCut ? DIE_CUTTING.setupCost + DIE_CUTTING.costPerUnit * quantity : 0;
  return laminationCost + dieCutCost;
}

/** Discount rate for a given order quantity (0 if below the first tier). */
function quantityDiscountRate(quantity) {
  for (const tier of QUANTITY_DISCOUNTS) {
    if (quantity >= tier.minQty) {
      return tier.rate;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Quote assembly
// ---------------------------------------------------------------------------

/**
 * Build a full quote from a specification.
 *
 * Money handling: all intermediate values are kept at full precision and
 * only rounded once, at the edge of each reported figure. VAT is always
 * calculated on the discounted order total, never per unit, so the quote
 * matches what an invoice would actually show (see bug ticket #7).
 *
 * @returns quote object with a line-by-line breakdown, all figures in GBP.
 */
function calculateQuote(spec) {
  validateSpec(spec);

  const {
    displayType, boardGrade, printProcess,
    lamination = 'none', dieCut = false, includeVat = true, quantity,
  } = spec;

  const areaM2 = calculateBlankArea(spec);

  const materials = materialCostPerUnit(areaM2, boardGrade) * quantity;
  const printing = calculatePrintCost(areaM2, printProcess, quantity).total;
  const finishing = calculateFinishingCost(areaM2, lamination, dieCut, quantity);
  const assembly = DISPLAY_TYPES[displayType].assemblyCostPerUnit * quantity;

  const productionCost = materials + printing + finishing + assembly;
  const sellBeforeDiscount = productionCost * (1 + MARGIN_RATE);

  const discountRate = quantityDiscountRate(quantity);
  const discount = sellBeforeDiscount * discountRate;
  const netTotal = sellBeforeDiscount - discount;
  // VAT is worked out per unit and multiplied back up to the order total.
  const unitNet = netTotal / quantity;
  const vat = includeVat ? round2(unitNet * VAT_RATE) * quantity : 0;
  const grandTotal = netTotal + vat;

  return {
    spec: { ...spec, lamination, dieCut, includeVat },
    areaM2: Math.round(areaM2 * 10000) / 10000,
    breakdown: {
      materials: round2(materials),
      printing: round2(printing),
      finishing: round2(finishing),
      assembly: round2(assembly),
    },
    productionCost: round2(productionCost),
    margin: round2(sellBeforeDiscount - productionCost),
    discountRate,
    discount: round2(discount),
    netTotal: round2(netTotal),
    vat: round2(vat),
    grandTotal: round2(grandTotal),
    unitPrice: round2(grandTotal / quantity),
  };
}

/**
 * Net unit price (ex VAT) at each standard quantity tier, so buyers can
 * see how price breaks affect their order. Returns one row per tier.
 */
function calculatePriceBreaks(spec) {
  const tiers = [50, 100, 250, 500, 1000];
  return tiers.map((quantity) => {
    const quote = calculateQuote({ ...spec, quantity, includeVat: false });
    return {
      quantity,
      discountRate: quote.discountRate,
      unitPrice: round2(quote.netTotal / quantity),
      netTotal: quote.netTotal,
    };
  });
}

// ---------------------------------------------------------------------------
// Exports — CommonJS for Jest, attached to window for the browser.
// ---------------------------------------------------------------------------

const api = {
  BOARD_GRADES,
  DISPLAY_TYPES,
  PRINT_PROCESSES,
  LAMINATION,
  QUANTITY_DISCOUNTS,
  WASTE_FACTOR,
  MARGIN_RATE,
  VAT_RATE,
  round2,
  validateSpec,
  calculateBlankArea,
  materialCostPerUnit,
  calculatePrintCost,
  calculateFinishingCost,
  quantityDiscountRate,
  calculateQuote,
  calculatePriceBreaks,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.BoardCost = api;
}
