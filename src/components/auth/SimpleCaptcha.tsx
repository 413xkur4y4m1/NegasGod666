'use client';

import { useState, useEffect, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SimpleCaptchaProps {
  onVerify: (isVerified: boolean) => void;
}

export const SimpleCaptcha = forwardRef<HTMLInputElement, SimpleCaptchaProps>(
  ({ onVerify }, ref) => {
    const [num1, setNum1] = useState(0);
    const [num2, setNum2] = useState(0);

    useEffect(() => {
      setNum1(Math.floor(Math.random() * 10) + 1);
      setNum2(Math.floor(Math.random() * 10) + 1);
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const userAnswer = parseInt(event.target.value, 10);
      onVerify(userAnswer === num1 + num2);
    };

    return (
      <div className="space-y-2">
        <Label htmlFor="captcha">Verificación: ¿Cuánto es {num1} + {num2}?</Label>
        <Input
          id="captcha"
          type="number"
          onChange={handleChange}
          ref={ref}
          placeholder="Resuelve la suma"
          required
        />
      </div>
    );
  }
);

SimpleCaptcha.displayName = 'SimpleCaptcha';
