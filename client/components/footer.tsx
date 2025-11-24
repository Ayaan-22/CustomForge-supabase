import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function Footer() {
  return (
    <footer className="border-t bg-background/80">
      <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-4">
        <div className="space-y-2">
          <div className="text-lg font-heading">CustomForge</div>
          <p className="text-sm text-muted-foreground">
            Premium gaming components and software, curated for performance.
          </p>
        </div>
        <div>
          <div className="font-medium">Shop</div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>
              <Link href="/products?category=GPU">GPUs</Link>
            </li>
            <li>
              <Link href="/products?category=CPU">CPUs</Link>
            </li>
            <li>
              <Link href="/products?category=Peripherals">Peripherals</Link>
            </li>
            <li>
              <Link href="/products?category=Software">Software</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-medium">Support</div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>
              <Link href="#">Shipping & Returns</Link>
            </li>
            <li>
              <Link href="#">Warranty</Link>
            </li>
            <li>
              <Link href="#">Contact</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-medium">Newsletter</div>
          <p className="mt-2 text-sm text-muted-foreground">Get deals and updates.</p>
          <div className="mt-3 flex gap-2">
            <Input placeholder="you@example.com" />
            <Button>Subscribe</Button>
          </div>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CustomForge. All rights reserved.
      </div>
    </footer>
  )
}
