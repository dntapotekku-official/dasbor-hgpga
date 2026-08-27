export const outlet_category_options = [
  { value: "non_pariwisata", label: "Non Pariwisata" },
  { value: "pariwisata", label: "Pariwisata" },
  { value: "parsial", label: "Parsial" },
];

export const outlet_category_filter_options = [
  { value: "all", label: "Semua Kategori" },
  ...outlet_category_options,
];

export const outlet_category_slug_options = outlet_category_options.map((category) => ({
  ...category,
  value: category.value.replace(/_/g, "-"),
}));

export const outlet_category_slugs = outlet_category_slug_options.map(
  (category) => category.value,
);
