/**
 * Ishihara Color Vision Plates (Static Images)
 * 
 * Sourced from /plates directory.
 */

export interface PlateDefinition {
    id: number;
    correctAnswer: string;
    imageSrc: string;
}

export const PLATES: PlateDefinition[] = [
    { id: 1, correctAnswer: '12', imageSrc: '/plates/ishihara12.png' },
    { id: 2, correctAnswer: '8', imageSrc: '/plates/ishihara8.png' },
    { id: 3, correctAnswer: '5', imageSrc: '/plates/ishihara5.png' },
    { id: 4, correctAnswer: '29', imageSrc: '/plates/ishihara29.png' },
    { id: 5, correctAnswer: '74', imageSrc: '/plates/ishihara74.png' },
    { id: 6, correctAnswer: '7', imageSrc: '/plates/ishihara7.png' },
    { id: 7, correctAnswer: '45', imageSrc: '/plates/ishihara45.png' },
    { id: 8, correctAnswer: '2', imageSrc: '/plates/ishihara2.png' },
    { id: 9, correctAnswer: '16', imageSrc: '/plates/ishihara16.png' },
    { id: 10, correctAnswer: '35', imageSrc: '/plates/ishihara35.png' },
    { id: 11, correctAnswer: '96', imageSrc: '/plates/ishihara96.png' },
];

// Dummy exports to prevent immediate build errors in ColorVisionTest.tsx
export interface Dot { cx: number; cy: number; r: number; color: string; }
export function generatePlateDots(plate: any, size: number, count: number): Dot[] { return []; }
