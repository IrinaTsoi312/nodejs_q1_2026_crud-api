export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  cathegory: string;
  inStock: boolean;
};

export type NewProduct = Omit<Product, "id">;

export type Products = Product[];
