// server/models/PrebuiltPc.js
import { supabase } from "../config/db.js";

/* ===========================================================
   MAP
=========================================================== */

const mapPrebuiltPcRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    description: row.description,
    category: row.category,
    cpu: row.cpu,
    gpu: row.gpu,
    motherboard: row.motherboard,
    ram: row.ram,
    storage: row.storage,
    powerSupply: row.power_supply,
    pcCase: row.pc_case,
    coolingSystem: row.cooling_system,
    operatingSystem: row.operating_system,
    warrantyPeriod: row.warranty_period,
    images: row.images || [],
    stock: row.stock,
    ratings: row.ratings,
    features: row.features || [],
    sku: row.sku,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/* ===========================================================
   CRUD
=========================================================== */

export const createPrebuiltPc = async (payload) => {
  const { data, error } = await supabase
    .from("prebuilt_pcs")
    .insert([
      {
        product_id: payload.productId,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        cpu: payload.cpu,
        gpu: payload.gpu,
        motherboard: payload.motherboard,
        ram: payload.ram,
        storage: payload.storage,
        power_supply: payload.powerSupply,
        pc_case: payload.pcCase,
        cooling_system: payload.coolingSystem,
        operating_system: payload.operatingSystem,
        warranty_period: payload.warrantyPeriod,
        images: payload.images ?? [],
        stock: payload.stock ?? 0,
        ratings: payload.ratings ?? null,
        features: payload.features ?? [],
        sku: payload.sku,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapPrebuiltPcRow(data);
};

export const getPrebuiltPcByProductId = async (productId) => {
  const { data, error } = await supabase
    .from("prebuilt_pcs")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapPrebuiltPcRow(data) : null;
};

export const updatePrebuiltPc = async (id, updates) => {
  const dbUpdates = {
    name: updates.name,
    description: updates.description,
    category: updates.category,
    cpu: updates.cpu,
    gpu: updates.gpu,
    motherboard: updates.motherboard,
    ram: updates.ram,
    storage: updates.storage,
    power_supply: updates.powerSupply,
    pc_case: updates.pcCase,
    cooling_system: updates.coolingSystem,
    operating_system: updates.operatingSystem,
    warranty_period: updates.warrantyPeriod,
    images: updates.images,
    stock: updates.stock,
    ratings: updates.ratings,
    features: updates.features,
    sku: updates.sku,
    updated_at: new Date().toISOString(),
  };

  Object.keys(dbUpdates).forEach(
    (key) => dbUpdates[key] === undefined && delete dbUpdates[key]
  );

  const { data, error } = await supabase
    .from("prebuilt_pcs")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapPrebuiltPcRow(data);
};

export const deletePrebuiltPc = async (id) => {
  const { error } = await supabase
    .from("prebuilt_pcs")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  return true;
};
