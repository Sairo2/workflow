import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    req.validated = {};

    if (schemas.body) {
      req.validated.body = schemas.body.parse(req.body);
      req.body = req.validated.body;
    }

    if (schemas.query) {
      req.validated.query = schemas.query.parse(req.query);
    }

    if (schemas.params) {
      req.validated.params = schemas.params.parse(req.params);
    }

    next();
  };
}
