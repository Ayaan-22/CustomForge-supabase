"use client";

import type React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthService } from "@/services/auth-service";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const { toast } = useToast();
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.querySelector("#name") as HTMLInputElement).value;
    const email = (form.querySelector("#email") as HTMLInputElement).value;
    const password = (form.querySelector("#password") as HTMLInputElement)
      .value;
    const passwordConfirm = (
      form.querySelector("#passwordConfirm") as HTMLInputElement
    ).value;
    const res = await AuthService.register({
      name,
      email,
      password,
      passwordConfirm,
    });
    if (res.error) {
      toast({
        title: "Registration failed",
        description: res.error.message,
        variant: "destructive",
      });
      return;
    }

    // Show success message - user needs to verify email
    toast({
      title: "Registration successful!",
      description: "Please check your email to verify your account.",
    });

    // Redirect to login after a delay
    setTimeout(() => {
      location.href = "/login";
    }, 2000);
  }

  return (
    <div className="container mx-auto grid place-items-center px-4 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6"
      >
        <h1 className="font-heading text-2xl">Create account</h1>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirm">Confirm Password</Label>
          <Input id="passwordConfirm" type="password" required />
        </div>
        <Button type="submit" className="w-full">
          Register
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
