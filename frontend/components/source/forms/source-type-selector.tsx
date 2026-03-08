"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Link2, Upload } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

interface SourceTypeSelectorProps {
  form: UseFormReturn<any>;
  value: "pdf" | "url" | "bulk";
  onValueChange: (value: "pdf" | "url" | "bulk") => void;
}

export function SourceTypeSelector({ form, value, onValueChange }: SourceTypeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Source Type</CardTitle>
        <CardDescription className="text-sm">
          Choose how you want to add your source
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(val: "pdf" | "url" | "bulk") => {
            onValueChange(val);
            form.setValue("sourceType", val);
          }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pdf" id="pdf-main" />
            <label
              htmlFor="pdf-main"
              className="flex-1 cursor-pointer border rounded-lg p-3 hover:bg-accent transition-colors min-h-[80px] flex items-center"
            >
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <p className="font-medium text-sm">Upload PDF</p>
                </div>
                <p className="text-xs text-muted-foreground">Research paper</p>
              </div>
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="url" id="url-main" />
            <label
              htmlFor="url-main"
              className="flex-1 cursor-pointer border rounded-lg p-3 hover:bg-accent transition-colors min-h-[80px] flex items-center"
            >
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <p className="font-medium text-sm">Add URL</p>
                </div>
                <p className="text-xs text-muted-foreground">Grey literature</p>
              </div>
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="bulk" id="bulk-main" />
            <label
              htmlFor="bulk-main"
              className="flex-1 cursor-pointer border rounded-lg p-3 hover:bg-accent transition-colors min-h-[80px] flex items-center"
            >
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <p className="font-medium text-sm">Bulk Upload</p>
                </div>
                <p className="text-xs text-muted-foreground">IEEE, ACM, SCOPUS</p>
              </div>
            </label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
