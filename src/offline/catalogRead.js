import { countCategories } from './repositories/categoriesRepo.js';
import { countCustomers } from './repositories/customersRepo.js';
import { countPaymentMethods } from './repositories/paymentMethodsRepo.js';
import { countProducts } from './repositories/productsRepo.js';

export const OFFLINE_CATALOG_EMPTY_MESSAGE =
  'Connect to the internet once to download catalog';

export async function hasOfflineCatalogCache() {
  const [products, categories, customers, paymentMethods] = await Promise.all([
    countProducts(),
    countCategories(),
    countCustomers(),
    countPaymentMethods(),
  ]);
  return products > 0 || categories > 0 || customers > 0 || paymentMethods > 0;
}

export async function hasOfflineProductCache() {
  return (await countProducts()) > 0;
}
