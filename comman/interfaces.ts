export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  message?: string;
}
