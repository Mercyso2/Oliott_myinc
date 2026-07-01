declare module "react-day-picker" {
  import * as React from "react";

  export const DayPicker: React.ComponentType<any>;
  export const DayButton: React.ComponentType<any>;
  export function getDefaultClassNames(): Record<string, string>;
}
