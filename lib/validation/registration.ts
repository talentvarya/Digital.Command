import { z } from "zod";

export const accountSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AccountInput = z.infer<typeof accountSchema>;

export const detailsSchema = z.object({
  businessType: z.enum(["individual", "proprietorship", "partnership", "private_limited", "public_limited"]),
  legalName: z.string().trim().min(2, "Business/legal name is required"),
  planCode: z.enum(["package_a", "package_b", "custom"]),
  billingTerm: z.enum(["quarterly", "half_yearly", "yearly"]),
  amount: z.coerce.number().positive("Enter the amount paid"),
  transactionRef: z.string().trim().min(4, "Enter the transaction / UTR number"),
  paymentDate: z.string().min(1, "Select the payment date"),
  promoOptIn: z.coerce.boolean().optional().default(false),
});

export type DetailsInput = z.infer<typeof detailsSchema>;
