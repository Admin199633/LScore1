import { proteinFoods, type ProteinFoodEntry, type FoodUnit } from './proteinFoods';

export type ProteinLineParse = {
  originalText: string;
  cleanedFoodText: string;
  grams?: number;
  quantity?: number;
  unit?: 'tbsp' | 'tsp' | 'cup' | 'unit' | 'slice' | 'box';
};

export type ProteinItemResult = {
  originalText: string;
  displayName: string;
  proteinGrams: number | null;
  status: 'calculated' | 'unresolved';
  reason?: string;
  confidence?: 'high' | 'medium' | 'low';
  suggestions?: string[];
};

export type ProteinCalculationResult = {
  items: ProteinItemResult[];
  totalProteinGrams: number;
  unresolvedCount: number;
};

export type NutritionValues = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionItemResult = {
  originalText: string;
  name: string;
  nutrition: Partial<NutritionValues>;
  isPartial: boolean;
  status: 'calculated' | 'unresolved';
  confidence?: 'high' | 'medium' | 'low';
  reason?: string;
  suggestions?: string[];
};

export type NutritionCalculationResult = {
  items: NutritionItemResult[];
  totals: Partial<NutritionValues>;
  totalProteinGrams: number;
  hasPartialNutrition: boolean;
  unresolvedCount: number;
};

export type FoodMatchConfidence = 'high' | 'medium' | 'low';

export type FoodMatchResult = {
  matchedFood: ProteinFoodEntry | null;
  confidence: FoodMatchConfidence;
  reason?: string;
  suggestions: string[];
  matchType:
    | 'exact_canonical'
    | 'exact_alias'
    | 'normalized'
    | 'fuzzy'
    | 'none';
};

const hebrewNumberWordMap: Record<string, string> = {
  אחד: '1',
  אחת: '1',
  שני: '2',
  שתי: '2',
  שניים: '2',
  שתיים: '2',
  שלוש: '3',
  שלושה: '3',
  ארבע: '4',
  ארבעה: '4',
  חמש: '5',
  חמישה: '5',
  שש: '6',
  שישה: '6',
  שבע: '7',
  שבעה: '7',
  שמונה: '8',
  תשע: '9',
  תשעה: '9',
  עשר: '10',
  עשרה: '10',
  עשרים: '20',
  שלושים: '30',
  ארבעים: '40',
  חמישים: '50',
  שישים: '60',
  שבעים: '70',
  שמונים: '80',
  תשעים: '90',
  מאה: '100',
  מאתיים: '200',
  חצי: '0.5',
  רבע: '0.25',
};

const supportedHebrewUnitMap: Record<string, 'tbsp' | 'tsp' | 'cup' | 'g' | 'kg' | 'unit' | 'slice' | 'box'> = {
  כף: 'tbsp',
  כפות: 'tbsp',
  כפית: 'tsp',
  כפיות: 'tsp',
  כוס: 'cup',
  כוסות: 'cup',
  גרם: 'g',
  גרמים: 'g',
  קילוגרם: 'kg',
  קילו: 'kg',
  יחידה: 'unit',
  יחידות: 'unit',
  פרוסה: 'slice',
  פרוסות: 'slice',
  קופסה: 'box',
  קופסא: 'box',
  קופסאות: 'box',
};

const stableUnitTokens = ['tbsp', 'tsp', 'cup', 'g', 'kg', 'unit', 'slice', 'box'] as const;
const stableUnitPattern = stableUnitTokens.join('|');
const hebrewUnitPattern = Object.keys(supportedHebrewUnitMap).join('|');
const listSplitNumberPattern = Object.keys(hebrewNumberWordMap).join('|');
const genericJoinerWords = new Set(['עם', 'של', 'בלי', 'ללא', 'ו', 'the', 'of']);

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

const normalizeFoodText = (value: string | null | undefined) =>
  String(value || '')
    .toLowerCase()
    .replace(/[.,/\\()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseNumericValue = (value: string | null | undefined) => Number(String(value || '').replace(',', '.'));

const removeMatchedSegment = (input: string, segment: string) =>
  input.replace(segment, ' ').replace(/\s+/g, ' ').trim();

const removeSupportedUnits = (input: string) =>
  input
    .replace(new RegExp(`(^|\\s)(${hebrewUnitPattern}|${stableUnitPattern})(?=\\s|$)`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getMeaningfulFoodTokens = (value: string | null | undefined) =>
  normalizeFoodText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !genericJoinerWords.has(token));

const toUniqueSuggestions = (values: string[]) => Array.from(new Set(values.filter(Boolean))).slice(0, 3);

const formatNormalizedNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(roundToOneDecimal(value));

export const normalizeHebrewNumbers = (input: string): string => {
  const sanitizedInput = String(input || '').replace(/\s+/g, ' ').trim();

  return sanitizedInput
    .replace(
      new RegExp(
        `(^|\\s)(${Object.keys(hebrewNumberWordMap).join('|')})(?=\\s|$)`,
        'g'
      ),
      (match, leadingWhitespace, word) => `${leadingWhitespace}${hebrewNumberWordMap[word] || word}`
    )
    .replace(
      /(^|\s)(100|200)\s+(20|30|40|50|60|70|80|90|1|2|3|4|5|6|7|8|9|10)(?=\s|$)/g,
      (match, leadingWhitespace, hundreds, remainder) =>
        `${leadingWhitespace}${Number(hundreds) + Number(remainder)}`
    )
    .replace(
      /(^|\s)(\d+(?:[.,]\d+)?)\s+וחצי(?=\s|$)/g,
      (match, leadingWhitespace, quantity) =>
        `${leadingWhitespace}${formatNormalizedNumber(parseNumericValue(quantity) + 0.5)}`
    )
    .replace(
      /(^|\s)(\d+(?:[.,]\d+)?)\s+([^\s]+)\s+וחצי(?=\s|$)/g,
      (match, leadingWhitespace, quantity, unitWord) =>
        `${leadingWhitespace}${formatNormalizedNumber(parseNumericValue(quantity) + 0.5)} ${unitWord}`
    )
    .replace(
      new RegExp(`(^|\\s)(${hebrewUnitPattern})\\s+וחצי(?=\\s|$)`, 'g'),
      (match, leadingWhitespace, unitWord) => `${leadingWhitespace}1.5 ${unitWord}`
    )
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeHebrewNumberWords = normalizeHebrewNumbers;

export const normalizeHebrewUnits = (input: string): string =>
  String(input || '')
    .replace(
      new RegExp(`(^|\\s)(${hebrewUnitPattern})(?=\\s|$)`, 'g'),
      (match, leadingWhitespace, unitWord) =>
        `${leadingWhitespace}${supportedHebrewUnitMap[unitWord] || unitWord}`
    )
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeNutritionInput = (input: string): string => {
  const normalizedText = normalizeHebrewUnits(
    normalizeHebrewNumbers(
      String(input || '')
        .replace(/[,:;!?()[\]{}]+/g, ' ')
        .replace(/(\d(?:[.,]\d+)?)([A-Za-z\u0590-\u05FF])/g, '$1 $2')
        .replace(/([A-Za-z\u0590-\u05FF])(\d(?:[.,]\d+)?)/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
    )
  );

  return normalizedText
    .replace(
      new RegExp(`(^|\\s)(${stableUnitPattern})\\s+([^\\d].*?)\\s+וחצי$`),
      (match, leadingWhitespace, unitWord, foodText) =>
        `${leadingWhitespace}1.5 ${unitWord} ${String(foodText || '').trim()}`
    )
    .replace(/\s+/g, ' ')
    .trim();
};

export const splitNutritionItems = (input: string): string[] => {
  const sanitizedInput = String(input || '')
    .replace(/\r?\n/g, ',')
    .replace(/[;|]+/g, ',')
    .replace(/\s+ו-\s*(?=(\d|[A-Za-z\u0590-\u05FF]))/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitizedInput) {
    return [];
  }

  return sanitizedInput
    .split(',')
    .map((segment) => normalizeNutritionInput(segment))
    .map((segment) => segment.trim())
    .filter(Boolean);
};

const normalizeSupportedUnit = (
  value: string | null | undefined
): 'tbsp' | 'tsp' | 'cup' | 'unit' | 'slice' | 'box' | null => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue === 'tbsp' ||
    normalizedValue === 'tsp' ||
    normalizedValue === 'cup' ||
    normalizedValue === 'unit' ||
    normalizedValue === 'slice' ||
    normalizedValue === 'box'
  ) {
    return normalizedValue;
  }

  return null;
};

// Gram equivalents for generic volume/count units (used as fallback for weight-only foods)
const UNIT_TO_GRAMS: Partial<Record<string, number>> = {
  tbsp: 15,
  tsp: 5,
  cup: 240,
};

// Human-readable Hebrew prompt for each unit label
const unitLabelToHebrewPrompt: Record<string, string> = {
  unit: 'יחידות',
  tbsp: 'כפות',
  tsp: 'כפיות',
  cup: 'כוסות',
  slice: 'פרוסות',
  box: 'קופסאות',
  קופסה: 'קופסאות',
  גביע: 'גביעים',
  מנה: 'מנות',
};

const getMissingAmountReason = (displayText: string, food: ProteinFoodEntry): string => {
  const firstUnit = food.units?.[0];
  if (!firstUnit) return 'חסרים נתוני חישוב למזון';
  if (firstUnit.type === 'weight') return `${displayText} - צריך להוסיף כמה גרם`;
  const prompt = unitLabelToHebrewPrompt[firstUnit.label] ?? 'יחידות';
  return `${displayText} - צריך להוסיף כמה ${prompt}`;
};

const parseLine = (line: string): ProteinLineParse => {
  const trimmedLine = normalizeNutritionInput(line).trim();
  const gramsMatch = trimmedLine.match(/(\d+(?:[.,]\d+)?)\s*(g|kg)(?=\s|$)/);

  if (gramsMatch) {
    const numericValue = parseNumericValue(gramsMatch[1]);
    const grams = gramsMatch[2] === 'kg' ? numericValue * 1000 : numericValue;
    return {
      originalText: trimmedLine,
      cleanedFoodText: removeMatchedSegment(trimmedLine, gramsMatch[0]),
      grams,
    };
  }

  const spoonQuantityMatch = trimmedLine.match(
    /(\d+(?:[.,]\d+)?)\s*(tbsp|tsp|cup|unit|slice|box)(?=\s|$)|(^|\s)(tbsp|tsp|cup|unit|slice|box)\s*(\d+(?:[.,]\d+)?)(?=\s|$)/
  );
  if (spoonQuantityMatch) {
    const quantity = parseNumericValue(spoonQuantityMatch[1] || spoonQuantityMatch[5]);
    const unit = normalizeSupportedUnit(spoonQuantityMatch[2] || spoonQuantityMatch[4]);

    return {
      originalText: trimmedLine,
      cleanedFoodText: removeSupportedUnits(removeMatchedSegment(trimmedLine, spoonQuantityMatch[0])),
      quantity,
      ...(unit ? { unit } : {}),
    };
  }

  const quantityMatch = trimmedLine.match(/(\d+(?:[.,]\d+)?)/);
  if (quantityMatch) {
    const quantity = parseNumericValue(quantityMatch[1]);
    return {
      originalText: trimmedLine,
      cleanedFoodText: removeSupportedUnits(removeMatchedSegment(trimmedLine, quantityMatch[0])),
      quantity,
    };
  }

  return {
    originalText: trimmedLine,
    cleanedFoodText: trimmedLine,
  };
};

const matchFood = (foodText: string, foods: ProteinFoodEntry[]): ProteinFoodEntry | null => {
  const trimmedFoodText = foodText.trim();
  if (!trimmedFoodText) {
    return null;
  }

  const exactCanonicalMatch =
    foods.find((food) => food.name === trimmedFoodText) || null;
  if (exactCanonicalMatch) {
    return exactCanonicalMatch;
  }

  const exactAliasMatch =
    foods.find((food) => food.aliases.some((alias) => alias === trimmedFoodText)) || null;
  if (exactAliasMatch) {
    return exactAliasMatch;
  }

  const normalizedFoodText = normalizeFoodText(trimmedFoodText);
  if (!normalizedFoodText) {
    return null;
  }

  const normalizedMatch =
    foods.find((food) => {
      const normalizedNames = [food.name, ...food.aliases].map(normalizeFoodText);
      return normalizedNames.includes(normalizedFoodText);
    }) || null;

  return normalizedMatch;
};

export const resolveFoodMatch = (
  parsedItem: ProteinLineParse,
  foods: ProteinFoodEntry[] = proteinFoods
): FoodMatchResult => {
  const cleanedFoodText = String(parsedItem.cleanedFoodText || '').trim();
  if (!cleanedFoodText) {
    return {
      matchedFood: null,
      confidence: 'low',
      reason: 'לא זוהה טקסט מזון',
      suggestions: [],
      matchType: 'none',
    };
  }

  const exactCanonicalMatch =
    foods.find((food) => food.name === cleanedFoodText) || null;
  if (exactCanonicalMatch) {
    return {
      matchedFood: exactCanonicalMatch,
      confidence: 'high',
      suggestions: [],
      matchType: 'exact_canonical',
    };
  }

  const exactAliasMatch =
    foods.find((food) => food.aliases.some((alias) => alias === cleanedFoodText)) || null;
  if (exactAliasMatch) {
    return {
      matchedFood: exactAliasMatch,
      confidence: 'high',
      suggestions: [],
      matchType: 'exact_alias',
    };
  }

  const normalizedFoodText = normalizeFoodText(cleanedFoodText);
  if (!normalizedFoodText) {
    return {
      matchedFood: null,
      confidence: 'low',
      reason: 'לא זוהה טקסט מזון',
      suggestions: [],
      matchType: 'none',
    };
  }

  const normalizedMatch = matchFood(cleanedFoodText, foods);
  if (normalizedMatch) {
    return {
      matchedFood: normalizedMatch,
      confidence: 'medium',
      suggestions: [],
      matchType: 'normalized',
    };
  }

  const inputTokens = getMeaningfulFoodTokens(cleanedFoodText);
  if (!inputTokens.length) {
    return {
      matchedFood: null,
      confidence: 'low',
      reason: 'לא נמצאה התאמה בטוחה למזון',
      suggestions: [],
      matchType: 'none',
    };
  }

  const fuzzyCandidates = foods
    .map((food) => {
      const candidateNames = [food.name, ...food.aliases];
      let bestScore = 0;

      for (const candidateName of candidateNames) {
        const candidateTokens = getMeaningfulFoodTokens(candidateName);
        if (!candidateTokens.length) {
          continue;
        }

        const sharedTokenCount = candidateTokens.filter((token) => inputTokens.includes(token)).length;
        if (!sharedTokenCount) {
          continue;
        }

        const allCandidateTokensCovered = candidateTokens.every((token) => inputTokens.includes(token));
        let score = sharedTokenCount / Math.max(candidateTokens.length, inputTokens.length);

        if (allCandidateTokensCovered && candidateTokens.length >= 2) {
          score = Math.max(score, 0.8);
        }

        if (
          candidateTokens.length >= 2 &&
          inputTokens.length >= candidateTokens.length &&
          normalizeFoodText(cleanedFoodText).includes(normalizeFoodText(candidateName))
        ) {
          score = Math.max(score, 0.85);
        }

        bestScore = Math.max(bestScore, score);
      }

      return {
        food,
        score: bestScore,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const suggestions = toUniqueSuggestions(
    fuzzyCandidates
      .filter((candidate) => candidate.score >= 0.4)
      .map((candidate) => candidate.food.name)
  );
  const bestCandidate = fuzzyCandidates[0];

  if (bestCandidate && bestCandidate.score >= 0.8) {
    return {
      matchedFood: bestCandidate.food,
      confidence: 'medium',
      suggestions,
      matchType: 'fuzzy',
    };
  }

  return {
    matchedFood: null,
    confidence: 'low',
    reason: 'לא נמצאה התאמה בטוחה למזון',
    suggestions,
    matchType: 'none',
  };
};

const buildCalculatedItem = (
  originalText: string,
  displayName: string,
  proteinGrams: number,
  confidence: FoodMatchConfidence = 'high'
): ProteinItemResult => ({
  originalText,
  displayName,
  proteinGrams: roundToOneDecimal(proteinGrams),
  status: 'calculated',
  confidence,
});

const buildUnresolvedItem = (
  originalText: string,
  displayName: string,
  reason: string,
  confidence: FoodMatchConfidence = 'low',
  suggestions?: string[]
): ProteinItemResult => ({
  originalText,
  displayName,
  proteinGrams: null,
  status: 'unresolved',
  reason,
  confidence,
  ...(suggestions?.length ? { suggestions } : {}),
});

/**
 * Resolves nutrition values for a parsed line against the new units[] schema.
 * Returns scaled nutrition and isPartial flag, or null if no calculation is possible.
 */
const resolveNutritionFromUnits = (
  parsedLine: ProteinLineParse,
  food: ProteinFoodEntry
): { nutrition: Partial<NutritionValues>; isPartial: boolean } | null => {
  const units = food.units ?? [];
  let matchedUnit: FoodUnit | null = null;
  let scaleFactor = 1;

  if (typeof parsedLine.grams === 'number') {
    // Gram-based: find any weight unit
    const weightUnit = units.find((u) => u.type === 'weight') ?? null;
    if (!weightUnit) return null;
    matchedUnit = weightUnit;
    scaleFactor = parsedLine.grams / (weightUnit.grams ?? 100);
  } else if (typeof parsedLine.quantity === 'number') {
    // Unit-based: try exact label match first
    if (parsedLine.unit) {
      const exactLabelUnit = units.find((u) => u.label === parsedLine.unit) ?? null;
      if (exactLabelUnit) {
        matchedUnit = exactLabelUnit;
        scaleFactor = parsedLine.quantity;
      }
    }

    // Fall back to generic unit type (treats tbsp/cup/etc. as a plain quantity multiplier)
    if (!matchedUnit) {
      const genericUnit = units.find((u) => u.type === 'unit') ?? null;
      if (genericUnit) {
        matchedUnit = genericUnit;
        scaleFactor = parsedLine.quantity;
      }
    }

    // Fall back to gram conversion for tbsp/tsp/cup on weight-only foods
    if (!matchedUnit && parsedLine.unit && parsedLine.unit in UNIT_TO_GRAMS) {
      const weightUnit = units.find((u) => u.type === 'weight') ?? null;
      if (weightUnit) {
        const gramsPerUnit = UNIT_TO_GRAMS[parsedLine.unit]!;
        matchedUnit = weightUnit;
        scaleFactor = (parsedLine.quantity * gramsPerUnit) / (weightUnit.grams ?? 100);
      }
    }

    if (!matchedUnit) return null;
  } else {
    return null;
  }

  // A unit is considered "partial" (protein-only) when calories is 0 or missing
  const isPartial = !matchedUnit.nutrition.calories;
  const protein = roundToOneDecimal(scaleFactor * matchedUnit.nutrition.protein);

  if (isPartial) {
    return { nutrition: { protein }, isPartial: true };
  }

  return {
    nutrition: {
      calories: roundToOneDecimal(scaleFactor * matchedUnit.nutrition.calories),
      protein,
      carbs: roundToOneDecimal(scaleFactor * matchedUnit.nutrition.carbs),
      fat: roundToOneDecimal(scaleFactor * matchedUnit.nutrition.fat),
    },
    isPartial: false,
  };
};

const calculateProteinForParsedLine = (
  parsedLine: ProteinLineParse,
  foods: ProteinFoodEntry[]
): ProteinItemResult => {
  if (!parsedLine.cleanedFoodText) {
    return buildUnresolvedItem(parsedLine.originalText, parsedLine.originalText, 'לא זוהה מזון');
  }

  const matchResult = resolveFoodMatch(parsedLine, foods);
  const matchedFood = matchResult.matchedFood;
  if (!matchedFood) {
    return buildUnresolvedItem(
      parsedLine.originalText,
      parsedLine.cleanedFoodText,
      matchResult.reason || 'לא נמצאה התאמה בטוחה למזון',
      matchResult.confidence,
      matchResult.suggestions
    );
  }

  const resolved = resolveNutritionFromUnits(parsedLine, matchedFood);
  if (resolved) {
    return buildCalculatedItem(
      parsedLine.originalText,
      matchedFood.name,
      resolved.nutrition.protein ?? 0,
      matchResult.confidence
    );
  }

  return buildUnresolvedItem(
    parsedLine.originalText,
    matchedFood.name,
    getMissingAmountReason(parsedLine.cleanedFoodText || matchedFood.name, matchedFood),
    matchResult.confidence
  );
};

const calculateNutritionForParsedLine = (
  parsedLine: ProteinLineParse,
  foods: ProteinFoodEntry[]
): NutritionItemResult => {
  if (!parsedLine.cleanedFoodText) {
    return {
      originalText: parsedLine.originalText,
      name: parsedLine.originalText,
      nutrition: {},
      isPartial: true,
      status: 'unresolved',
      reason: 'לא זוהה מזון',
    };
  }

  const matchResult = resolveFoodMatch(parsedLine, foods);
  const matchedFood = matchResult.matchedFood;
  if (!matchedFood) {
    return {
      originalText: parsedLine.originalText,
      name: parsedLine.cleanedFoodText,
      nutrition: {},
      isPartial: true,
      status: 'unresolved',
      confidence: matchResult.confidence,
      reason: matchResult.reason || 'לא נמצאה התאמה בטוחה למזון',
      ...(matchResult.suggestions.length ? { suggestions: matchResult.suggestions } : {}),
    };
  }

  const resolved = resolveNutritionFromUnits(parsedLine, matchedFood);
  if (resolved) {
    return {
      originalText: parsedLine.originalText,
      name: matchedFood.name,
      nutrition: resolved.nutrition,
      isPartial: resolved.isPartial,
      status: 'calculated',
      confidence: matchResult.confidence,
    };
  }

  return {
    originalText: parsedLine.originalText,
    name: matchedFood.name,
    nutrition: {},
    isPartial: true,
    status: 'unresolved',
    confidence: matchResult.confidence,
    reason: getMissingAmountReason(parsedLine.cleanedFoodText || matchedFood.name, matchedFood),
  };
};

export const parseProteinText = (input: string): ProteinLineParse[] =>
  splitNutritionItems(input).map(parseLine);

export const calculateProteinFromText = (
  input: string,
  foods: ProteinFoodEntry[] = proteinFoods
): ProteinCalculationResult => {
  const parsedLines = parseProteinText(input);
  const items = parsedLines.map((line) => calculateProteinForParsedLine(line, foods));
  const totalProteinGrams = roundToOneDecimal(
    items.reduce((sum, item) => sum + (item.proteinGrams || 0), 0)
  );
  const unresolvedCount = items.filter((item) => item.status === 'unresolved').length;

  return { items, totalProteinGrams, unresolvedCount };
};

/**
 * Aggregates nutrition totals from a list of NutritionItemResult.
 * Always sums protein. Only sums calories/carbs/fat from items that have them defined.
 */
export const aggregateNutrition = (items: NutritionItemResult[]): Partial<NutritionValues> => {
  let protein = 0;
  let calories: number | undefined;
  let carbs: number | undefined;
  let fat: number | undefined;

  for (const item of items) {
    if (item.status !== 'calculated') continue;
    protein += item.nutrition.protein ?? 0;
    if (typeof item.nutrition.calories === 'number') {
      calories = (calories ?? 0) + item.nutrition.calories;
    }
    if (typeof item.nutrition.carbs === 'number') {
      carbs = (carbs ?? 0) + item.nutrition.carbs;
    }
    if (typeof item.nutrition.fat === 'number') {
      fat = (fat ?? 0) + item.nutrition.fat;
    }
  }

  return {
    protein: roundToOneDecimal(protein),
    ...(typeof calories === 'number' ? { calories: roundToOneDecimal(calories) } : {}),
    ...(typeof carbs === 'number' ? { carbs: roundToOneDecimal(carbs) } : {}),
    ...(typeof fat === 'number' ? { fat: roundToOneDecimal(fat) } : {}),
  };
};

export const calculateNutritionFromParsedInput = (
  parsedLines: ProteinLineParse[],
  foods: ProteinFoodEntry[] = proteinFoods
): NutritionCalculationResult => {
  const items = parsedLines.map((line) => calculateNutritionForParsedLine(line, foods));
  const calculatedItems = items.filter((item) => item.status === 'calculated');
  const totals = aggregateNutrition(items);
  const totalProteinGrams = totals.protein ?? 0;
  const hasPartialNutrition = calculatedItems.some((item) => item.isPartial);
  const unresolvedCount = items.filter((item) => item.status === 'unresolved').length;

  return { items, totals, totalProteinGrams, hasPartialNutrition, unresolvedCount };
};

export const calculateNutritionFromText = (
  input: string,
  foods: ProteinFoodEntry[] = proteinFoods
): NutritionCalculationResult => {
  const parsedLines = parseProteinText(input);
  return calculateNutritionFromParsedInput(parsedLines, foods);
};
