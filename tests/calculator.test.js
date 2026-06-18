/**
 * Unit tests for the BoardCost calculation engine.
 *
 * These tests were written FIRST (red), then the engine was implemented to
 * make them pass (green), then refactored — see the TDD section of the README.
 */

const {
  round2,
  validateSpec,
  calculateBlankArea,
  materialCostPerUnit,
  calculatePrintCost,
  calculateFinishingCost,
  quantityDiscountRate,
  calculateQuote,
  WASTE_FACTOR,
  VAT_RATE,
} = require('../js/calculator');

/** A sensible baseline spec: a 600 x 1500 x 400mm FSDU, litho-lam, 100 off. */
function baseSpec(overrides = {}) {
  return {
    displayType: 'fsdu',
    widthMm: 600,
    heightMm: 1500,
    depthMm: 400,
    boardGrade: 'b-flute',
    printProcess: 'litho-lam',
    lamination: 'gloss-lam',
    dieCut: true,
    quantity: 100,
    includeVat: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// round2
// ---------------------------------------------------------------------------

describe('round2', () => {
  test('rounds to two decimal places', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10.0);
  });

  test('handles floating point edge cases like 1.005', () => {
    expect(round2(1.005)).toBe(1.01);
  });
});

// ---------------------------------------------------------------------------
// calculateBlankArea
// ---------------------------------------------------------------------------

describe('calculateBlankArea', () => {
  test('calculates blank area for an FSDU including waste', () => {
    // faces: (600*1500 + 400*1500 + 600*400) / 1e6 = 1.74 m²
    // FSDU areaFactor 3.2, waste 1.12 → 1.74 * 3.2 * 1.12 = 6.23616
    const area = calculateBlankArea({
      widthMm: 600, heightMm: 1500, depthMm: 400, displayType: 'fsdu',
    });
    expect(area).toBeCloseTo(6.23616, 5);
  });

  test('a standee of the same size uses less board than an FSDU', () => {
    const dims = { widthMm: 600, heightMm: 1500, depthMm: 400 };
    const fsdu = calculateBlankArea({ ...dims, displayType: 'fsdu' });
    const standee = calculateBlankArea({ ...dims, displayType: 'standee' });
    expect(standee).toBeLessThan(fsdu);
  });

  test('applies the standard waste factor', () => {
    const area = calculateBlankArea({
      widthMm: 1000, heightMm: 1000, depthMm: 1000, displayType: 'standee',
    });
    // faces = 3 m², factor 1.6 → 4.8 m² before waste
    expect(area).toBeCloseTo(4.8 * WASTE_FACTOR, 5);
  });

  test('throws for an unknown display type', () => {
    expect(() => calculateBlankArea({
      widthMm: 600, heightMm: 1500, depthMm: 400, displayType: 'gondola',
    })).toThrow(/unknown display type/i);
  });
});

// ---------------------------------------------------------------------------
// materialCostPerUnit
// ---------------------------------------------------------------------------

describe('materialCostPerUnit', () => {
  test('multiplies area by the board grade rate', () => {
    // 2 m² of B-flute at 0.72/m² = 1.44
    expect(materialCostPerUnit(2, 'b-flute')).toBeCloseTo(1.44, 5);
  });

  test('double wall costs more than single wall for the same area', () => {
    expect(materialCostPerUnit(2, 'bc-flute')).toBeGreaterThan(materialCostPerUnit(2, 'b-flute'));
  });

  test('throws for an unknown board grade', () => {
    expect(() => materialCostPerUnit(2, 'cardstock')).toThrow(/unknown board grade/i);
  });
});

// ---------------------------------------------------------------------------
// calculatePrintCost
// ---------------------------------------------------------------------------

describe('calculatePrintCost', () => {
  test('includes one-off setup plus per-unit running cost', () => {
    // digital: setup 45, 4.5/m². 1 m², 10 units → 45 + 45 = 90
    const cost = calculatePrintCost(1, 'digital', 10);
    expect(cost.setup).toBe(45);
    expect(cost.run).toBeCloseTo(45, 5);
    expect(cost.total).toBeCloseTo(90, 5);
  });

  test('digital beats litho-lam on short runs', () => {
    const digital = calculatePrintCost(1, 'digital', 50).total;
    const litho = calculatePrintCost(1, 'litho-lam', 50).total;
    expect(digital).toBeLessThan(litho);
  });

  test('litho-lam beats digital on long runs (setup amortised)', () => {
    const digital = calculatePrintCost(1, 'digital', 500).total;
    const litho = calculatePrintCost(1, 'litho-lam', 500).total;
    expect(litho).toBeLessThan(digital);
  });

  test('throws for an unknown print process', () => {
    expect(() => calculatePrintCost(1, 'screenprint', 10)).toThrow(/unknown print process/i);
  });
});

// ---------------------------------------------------------------------------
// calculateFinishingCost
// ---------------------------------------------------------------------------

describe('calculateFinishingCost', () => {
  test('no lamination and no die-cut costs nothing', () => {
    expect(calculateFinishingCost(2, 'none', false, 100)).toBe(0);
  });

  test('lamination is charged per m² across the run', () => {
    // gloss 0.55/m², 2 m², 100 units = 110
    expect(calculateFinishingCost(2, 'gloss-lam', false, 100)).toBeCloseTo(110, 5);
  });

  test('die-cutting adds a setup charge plus a per-unit charge', () => {
    // 120 setup + 0.08 * 100 = 128
    expect(calculateFinishingCost(2, 'none', true, 100)).toBeCloseTo(128, 5);
  });
});

// ---------------------------------------------------------------------------
// quantityDiscountRate
// ---------------------------------------------------------------------------

describe('quantityDiscountRate', () => {
  test.each([
    [1, 0],
    [49, 0],
    [50, 0.03],
    [99, 0.03],
    [100, 0.05],
    [250, 0.08],
    [500, 0.12],
    [999, 0.12],
    [1000, 0.15],
    [5000, 0.15],
  ])('quantity %i gets a discount rate of %f', (quantity, expected) => {
    expect(quantityDiscountRate(quantity)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// validateSpec
// ---------------------------------------------------------------------------

describe('validateSpec', () => {
  test('accepts a valid spec', () => {
    expect(() => validateSpec(baseSpec())).not.toThrow();
  });

  test('rejects zero and negative dimensions', () => {
    expect(() => validateSpec(baseSpec({ widthMm: 0 }))).toThrow(/positive/i);
    expect(() => validateSpec(baseSpec({ heightMm: -100 }))).toThrow(/positive/i);
  });

  test('rejects dimensions above the maximum blank size', () => {
    expect(() => validateSpec(baseSpec({ heightMm: 3000 }))).toThrow(/maximum/i);
  });

  test('rejects fractional or zero quantities', () => {
    expect(() => validateSpec(baseSpec({ quantity: 0 }))).toThrow(/quantity/i);
    expect(() => validateSpec(baseSpec({ quantity: 2.5 }))).toThrow(/quantity/i);
  });

  test('rejects unknown option keys with a clear message', () => {
    expect(() => validateSpec(baseSpec({ boardGrade: 'mdf' }))).toThrow(/board grade/i);
  });
});

// ---------------------------------------------------------------------------
// calculateQuote (integration of the steps above)
// ---------------------------------------------------------------------------

describe('calculateQuote', () => {
  test('breakdown lines sum to the production cost', () => {
    const q = calculateQuote(baseSpec());
    const sum = q.breakdown.materials + q.breakdown.printing
      + q.breakdown.finishing + q.breakdown.assembly;
    expect(sum).toBeCloseTo(q.productionCost, 1);
  });

  test('net total equals production cost plus margin minus discount', () => {
    const q = calculateQuote(baseSpec());
    expect(q.netTotal).toBeCloseTo(q.productionCost + q.margin - q.discount, 1);
  });

  test('applies the correct quantity discount tier', () => {
    const q = calculateQuote(baseSpec({ quantity: 250 }));
    expect(q.discountRate).toBe(0.08);
    expect(q.discount).toBeGreaterThan(0);
  });

  test('includeVat: false produces a zero VAT line', () => {
    const q = calculateQuote(baseSpec({ includeVat: false }));
    expect(q.vat).toBe(0);
    expect(q.grandTotal).toBe(q.netTotal);
  });

  test('unit price is the grand total divided by quantity', () => {
    const q = calculateQuote(baseSpec());
    expect(q.unitPrice).toBeCloseTo(q.grandTotal / q.spec.quantity, 2);
  });

  test('throws (does not return a quote) for an invalid spec', () => {
    expect(() => calculateQuote(baseSpec({ depthMm: -5 }))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculatePriceBreaks
