import { useForm as useHookForm, UseFormProps, FieldValues } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ObjectSchema } from "yup";

/**
 * Custom hook that wraps react-hook-form with Yup validation
 * Provides a consistent interface for form handling across the app
 */
export function useForm<TFormValues extends FieldValues = FieldValues>(
  schema: ObjectSchema<any>,
  options?: Omit<UseFormProps<TFormValues>, "resolver">
) {
  return useHookForm<TFormValues>({
    resolver: yupResolver(schema),
    mode: "onBlur",
    ...options,
  });
}
