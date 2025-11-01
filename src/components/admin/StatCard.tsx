'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import React from "react";

// Interface for the component's props
interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: number | string;
    description?: string;
    isWarning?: boolean;
}

// The reusable StatCard component
export function StatCard({ icon, title, value, description, isWarning }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${isWarning ? 'text-destructive' : ''}`}>{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${isWarning ? 'text-destructive' : ''}`}>{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );
}
