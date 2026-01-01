export const ROUTES = {
  home: "/",
  habits: "/habits",
} as const;

export const NAV_ITEMS = [
  { label: "Activity Clock", to: ROUTES.home },
  { label: "Habit Tracker", to: ROUTES.habits },
] as const;
