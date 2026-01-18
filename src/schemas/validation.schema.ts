import * as yup from "yup";

/**
 * Common validation schemas using Yup
 */

// Email validation
export const emailSchema = yup
  .string()
  .email("Please enter a valid email address")
  .required("Email is required");

// Password validation
export const passwordSchema = yup
  .string()
  .min(8, "Password must be at least 8 characters")
  .matches(/[a-z]/, "Password must contain at least one lowercase letter")
  .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
  .matches(/[0-9]/, "Password must contain at least one number")
  .required("Password is required");

// Name validation
export const nameSchema = yup
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(50, "Name must not exceed 50 characters")
  .required("Name is required");

// Phone validation
export const phoneSchema = yup
  .string()
  .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Please enter a valid phone number")
  .required("Phone number is required");

/**
 * Login Form Schema
 */
export const loginSchema = yup.object({
  email: emailSchema,
  password: yup.string().required("Password is required"),
});

export type LoginFormData = yup.InferType<typeof loginSchema>;

/**
 * Registration Form Schema
 */
export const registerSchema = yup.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Please confirm your password"),
});

export type RegisterFormData = yup.InferType<typeof registerSchema>;

/**
 * Contact Form Schema
 */
export const contactSchema = yup.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  subject: yup.string().required("Subject is required"),
  message: yup
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must not exceed 500 characters")
    .required("Message is required"),
});

export type ContactFormData = yup.InferType<typeof contactSchema>;

/**
 * Profile Update Schema
 */
export const profileUpdateSchema = yup.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  bio: yup.string().max(200, "Bio must not exceed 200 characters").optional(),
});

export type ProfileUpdateFormData = yup.InferType<typeof profileUpdateSchema>;

/**
 * Sign Up Form Schemas (Multi-Step)
 */

// Step 1: Basic Information
export const signUpStep1Schema = yup.object({
  authorizationCode: yup.string().required("Authorization code is required"),
  email: emailSchema,
  countryCode: yup.string().required("Country code is required"),
  phoneNumber: yup
    .string()
    .matches(/^[0-9]{6,15}$/, "Please enter a valid phone number (6-15 digits)")
    .required("Phone number is required"),
});

export type SignUpStep1Data = yup.InferType<typeof signUpStep1Schema>;

// Step 2: Account Details
export const signUpStep2Schema = yup.object({
  accountType: yup
    .string()
    .oneOf(["PERSONAL", "BUSINESS", "CORPORATE"], "Please select a valid account type")
    .required("Account type is required"),
  currency: yup.string().required("Currency is required"),
});

export type SignUpStep2Data = yup.InferType<typeof signUpStep2Schema>;

// Step 3: Security
export const signUpStep3Schema = yup.object({
  password: passwordSchema,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Please confirm your password"),
  transactionPin: yup
    .string()
    .matches(/^[0-9]{4}$/, "Transaction PIN must be exactly 4 digits")
    .required("Transaction PIN is required"),
  confirmTransactionPin: yup
    .string()
    .oneOf([yup.ref("transactionPin")], "Transaction PINs must match")
    .required("Please confirm your transaction PIN"),
});

export type SignUpStep3Data = yup.InferType<typeof signUpStep3Schema>;

// Combined Sign Up Schema
export const signUpSchema = yup.object({
  ...signUpStep1Schema.fields,
  ...signUpStep2Schema.fields,
  ...signUpStep3Schema.fields,
});

export type SignUpFormData = yup.InferType<typeof signUpSchema>;

/**
 * OTP Verification Schema
 */
export const otpVerificationSchema = yup.object({
  email: emailSchema,
  otp: yup
    .string()
    .matches(/^[0-9]{6}$/, "OTP must be exactly 6 digits")
    .required("OTP is required"),
});

export type OTPVerificationData = yup.InferType<typeof otpVerificationSchema>;
