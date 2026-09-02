// services/products.ts
// 商品資料共用邏輯，資料來源是公開測試 API（DummyJSON），僅供前端展示用，跟自家後端無關。
// home.tsx（商品分類/推薦）與 favorites.tsx（我的收藏）共用這裡的型別與 fetch 函式。
export const PRODUCTS_API = 'https://dummyjson.com';
export const ALL_CATEGORY = '__all__';

export interface ProductCategory {
  slug: string;
  name: string;
}

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
}

export async function fetchCategories(): Promise<ProductCategory[]> {
  const res = await fetch(`${PRODUCTS_API}/products/categories`);
  if (!res.ok) throw new Error('無法取得分類清單');
  const data: { slug: string; name: string }[] = await res.json();
  return data.map(({ slug, name }) => ({ slug, name }));
}

// 抓比實際顯示數量更多的候選商品，讓下拉重新整理時可以從中隨機洗牌出不同組合
export async function fetchProducts(categorySlug: string): Promise<Product[]> {
  const url = categorySlug === ALL_CATEGORY
    ? `${PRODUCTS_API}/products?limit=30`
    : `${PRODUCTS_API}/products/category/${categorySlug}?limit=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('無法取得商品列表');
  const data: { products: Product[] } = await res.json();
  return data.products;
}

export async function fetchProductById(id: number): Promise<Product> {
  const res = await fetch(`${PRODUCTS_API}/products/${id}`);
  if (!res.ok) throw new Error('無法取得商品資料');
  return res.json();
}
