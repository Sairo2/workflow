import { z } from "zod";

export const delegationParamsSchema = z.object({
  id: z.string().uuid()
});

export const createDelegationSchema = z
  .object({
    delegateId: z.string().uuid(),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date()
  })
  .superRefine((input, ctx) => {
    if (input.validFrom >= input.validTo) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "validTo must be after validFrom"
      });
    }
  });

export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;
