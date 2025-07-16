'use client';

import React, { useState, useEffect } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

type ColorFormat = 'hex' | 'rgb';

// Helper function to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Helper function to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (c: number): string => {
    const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [isOpen, setIsOpen] = useState(false);
  const [rgbValues, setRgbValues] = useState({ r: 0, g: 0, b: 0 });

  // Update RGB values when color changes
  useEffect(() => {
    setRgbValues(hexToRgb(color));
  }, [color]);

  const handleRgbChange = (component: 'r' | 'g' | 'b', value: string) => {
    const numValue = parseInt(value) || 0;
    const newRgb = { ...rgbValues, [component]: numValue };
    setRgbValues(newRgb);
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  const formatDisplayValue = (color: string) => {
    if (format === 'hex') {
      return color;
    } else {
      const rgb = hexToRgb(color);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Color preview and trigger */}
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-md border-2 border-gray-300 cursor-pointer shadow-sm"
          style={{ backgroundColor: color }}
          onClick={() => setIsOpen(!isOpen)}
        />
        <div className="flex-1">
          <Label className="text-sm font-medium">Color</Label>
          <div className="text-sm text-gray-600">{formatDisplayValue(color)}</div>
        </div>
      </div>

      {/* Color picker modal */}
      {isOpen && (
        <Card className="absolute top-12 left-0 z-50 w-64 shadow-lg">
          <CardContent className="p-4">
            {/* Color picker */}
            <div className="mb-4">
              <HexColorPicker 
                color={color} 
                onChange={onChange}
                style={{ width: '100%', height: '200px' }}
              />
            </div>

            {/* Format toggle */}
            <div className="mb-3">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-md">
                <Button
                  type="button"
                  variant={format === 'hex' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setFormat('hex')}
                >
                  HEX
                </Button>
                <Button
                  type="button"
                  variant={format === 'rgb' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setFormat('rgb')}
                >
                  RGB
                </Button>
              </div>
            </div>

            {/* Input fields */}
            {format === 'hex' ? (
              <div>
                <Label className="text-xs text-gray-600">Hex Value</Label>
                <HexColorInput
                  color={color}
                  onChange={onChange}
                  prefixed
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">RGB Values</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">R</Label>
                    <Input
                      type="number"
                      min="0"
                      max="255"
                      value={rgbValues.r}
                      onChange={(e) => handleRgbChange('r', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">G</Label>
                    <Input
                      type="number"
                      min="0"
                      max="255"
                      value={rgbValues.g}
                      onChange={(e) => handleRgbChange('g', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">B</Label>
                    <Input
                      type="number"
                      min="0"
                      max="255"
                      value={rgbValues.b}
                      onChange={(e) => handleRgbChange('b', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Close button */}
            <div className="mt-4 flex justify-end">
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 