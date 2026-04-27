"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FilterSidebar({
  categories,
  brands,
}: {
  categories: string[];
  brands: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [category, setCategory] = useState(params.get("category") || "All");
  const [brand, setBrand] = useState(params.get("brand") || "All");
  const [minRating, setMinRating] = useState(
    Number(params.get("minRating")) || 0
  );
  const [minPrice, setMinPrice] = useState(Number(params.get("minPrice")) || 0);
  const [maxPrice, setMaxPrice] = useState(
    Number(params.get("maxPrice")) || 3000
  );

  useEffect(() => {
    setCategory(params.get("category") || "All");
    setBrand(params.get("brand") || "All");
    setMinRating(Number(params.get("minRating")) || 0);
    setMinPrice(Number(params.get("minPrice")) || 0);
    setMaxPrice(Number(params.get("maxPrice")) || 3000);
  }, [params]);

  function apply() {
    const sp = new URLSearchParams(params.toString());
    category !== "All" ? sp.set("category", category) : sp.delete("category");
    brand !== "All" ? sp.set("brand", brand) : sp.delete("brand");
    minRating ? sp.set("minRating", String(minRating)) : sp.delete("minRating");
    sp.set("minPrice", String(minPrice));
    sp.set("maxPrice", String(maxPrice));
    sp.set("page", "1");
    router.push(`/products?${sp.toString()}`);
  }

  function reset() {
    router.push("/products");
  }

  return (
    <aside className="rounded-lg border bg-card/60 p-4 backdrop-blur">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Brand</Label>
          <Select value={brand} onValueChange={(v) => setBrand(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Minimum Rating</Label>
          <Select
            value={String(minRating)}
            onValueChange={(v) => setMinRating(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="0+" />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Price Range</Label>
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>${minPrice}</span>
            <span>${maxPrice}</span>
          </div>
          <Slider
            defaultValue={[minPrice, maxPrice]}
            min={0}
            max={3000}
            step={50}
            onValueChange={(v) => {
              setMinPrice(v[0]);
              setMaxPrice(v[1]);
            }}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={apply}>
            Apply
          </Button>
          <Button variant="secondary" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
    </aside>
  );
}
