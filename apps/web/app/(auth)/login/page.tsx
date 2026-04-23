"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, ArrowLeft } from "lucide-react";

import { requestOtp, verifyOtp } from "@/services/auth.service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email("Informe um endereço de e-mail válido"),
});

const otpSchema = z.object({
  token: z
    .string()
    .length(6, "O código deve ter exatamente 6 caracteres")
    .regex(/^\d+$/, "O código deve conter apenas números"),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [emailAddress, setEmailAddress] = useState("");

  // ── Etapa 1: formulário de e-mail ──
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const requestOtpMutation = useMutation({
    mutationFn: (email: string) => requestOtp(email),
    onSuccess: () => {
      toast.success("Código enviado! Verifique sua caixa de entrada.");
      setStep("otp");
    },
    onError: () => {
      toast.error("Não foi possível enviar o código. Tente novamente.");
    },
  });

  function handleEmailSubmit(values: EmailFormValues) {
    setEmailAddress(values.email);
    requestOtpMutation.mutate(values.email);
  }

  // ── Etapa 2: formulário OTP ──
  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: "" },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (token: string) => verifyOtp(emailAddress, token),
    onSuccess: () => {
      toast.success("Autenticado com sucesso!");
      router.push("/wallets");
    },
    onError: () => {
      toast.error("Código inválido ou expirado. Tente novamente.");
      otpForm.reset();
    },
  });

  function handleOtpSubmit(values: OtpFormValues) {
    verifyOtpMutation.mutate(values.token);
  }

  function handleBack() {
    setStep("email");
    otpForm.reset();
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Card className="shadow-lg border-neutral-border">
      <CardHeader className="space-y-1 pb-6">
        <Image
          src="/icon.png"
          width={400}
          height={120}
          alt="whalet"
          className="w-full h-auto"
        />

        {step === "email" ? (
          <>
            <CardTitle className="text-2xl font-bold -mt-[50px]">
              Bem-vindo(a) de volta
            </CardTitle>
            <CardDescription>
              Informe seu e-mail para receber um código de acesso
            </CardDescription>
          </>
        ) : (
          <>
            <CardTitle className="text-2xl font-bold">
              Verifique seu e-mail
            </CardTitle>
            <CardDescription>
              Enviamos um código de 6 dígitos para{" "}
              <span className="font-medium text-foreground">
                {emailAddress}
              </span>
            </CardDescription>
          </>
        )}
      </CardHeader>

      <CardContent>
        {step === "email" ? (
          <form
            onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  autoFocus
                  className={cn(
                    "pl-10 w-full",
                    emailForm.formState.errors.email && "border-destructive",
                  )}
                  {...emailForm.register("email")}
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-primary/90 min-h-10"
              disabled={requestOtpMutation.isPending}
            >
              {requestOtpMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando código...
                </>
              ) : (
                "Enviar código"
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={otpForm.handleSubmit(handleOtpSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="token">Código de acesso</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="token"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  className={cn(
                    "pl-10 text-center tracking-widest text-lg font-mono w-full",
                    otpForm.formState.errors.token && "border-destructive",
                  )}
                  {...otpForm.register("token")}
                />
              </div>
              {otpForm.formState.errors.token && (
                <p className="text-sm text-destructive">
                  {otpForm.formState.errors.token.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-primary/90 min-h-10"
              disabled={verifyOtpMutation.isPending}
            >
              {verifyOtpMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full min-h-10"
              onClick={handleBack}
              disabled={verifyOtpMutation.isPending}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Alterar e-mail
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Não recebeu o código?{" "}
              <button
                type="button"
                className="text-brand-primary hover:underline font-medium"
                onClick={() => requestOtpMutation.mutate(emailAddress)}
                disabled={requestOtpMutation.isPending}
              >
                Reenviar
              </button>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
