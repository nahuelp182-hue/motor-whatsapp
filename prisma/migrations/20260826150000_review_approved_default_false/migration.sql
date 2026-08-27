-- Las reseñas nunca deben publicarse solas: el default pasa de true a false.
ALTER TABLE "Review" ALTER COLUMN "approved" SET DEFAULT false;
