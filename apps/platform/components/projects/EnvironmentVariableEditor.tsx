import {
  ComponentProps,
  MutableRefObject,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { encryptString } from "@47ng/cloak";
import useSecret from "@/hooks/useSecret";
import { EnvSecret } from "@/types/index";
import { parseEnvContent, parseEnvFile } from "@/utils/envParser";
import { trpc } from "@/utils/trpc";
import clsx from "clsx";
import { Eye, EyeOff, MinusCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { DragDropIcon } from "@/components/icons";
import { Button, Container, TextareaGroup } from "@/components/theme";

export interface EnvVariable {
  envKey: string;
  envValue: string;
  hidden: boolean;
}

export function EnvironmentVariableEditor({ branchId }: { branchId: string }) {
  const [envKeys, setEnvKeys] = useState<EnvVariable[]>([]);
  const pastingInputIndex = useRef(0);

  const { secrets, setSecrets, decryptedProjectKey } = useSecret({
    branchId,
  });

  const { control, setValue, handleSubmit } = useForm<any>();
  const { fields, append, remove, update } = useFieldArray({
    name: "secrets",
    control,
  });
  const saveSecretsMutation = trpc.secrets.saveSecrets.useMutation();

  useEffect(() => {
    if (secrets) {
      setValue("secrets", secrets);
    }
  }, [secrets, setValue]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    await parseEnvFile(file, setEnvKeys);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    onDrop,
  });

  const handleAddMoreEnvClick = () => {
    append({
      id: null,
      encryptedKey: "",
      encryptedValue: "",
      decryptedKey: "",
      decryptedValue: "",
      hidden: false,
      hiddenValue: "",
    });
  };

  const handleToggleHiddenEnvPairClick = (index: number) => {
    const newEnvKeys = secrets.map((envVariable, i) => {
      const isHidden = () => {
        if (i === index) {
          return !envVariable.hidden;
        }

        return envVariable.hidden;
      };

      return {
        ...envVariable,
        hidden: isHidden(),
      } as EnvSecret;
    });

    setSecrets(newEnvKeys);
  };

  const handleEnvValueChange = (index: number) => (e) => {
    setEnvKeys(
      envKeys.map((envVariable, i) => {
        if (i === index) {
          return {
            ...envVariable,
            envValue: i === index ? e.target.value : envVariable.envValue,
          } as EnvVariable;
        }

        return envVariable;
      }),
    );
  };

  const handlePaste = async (event: any) => {
    const content = event.clipboardData.getData("text/plain") as string;
    const pastedEnvKeyValuePairs = await parseEnvContent(content);

    if (
      !(
        pastedEnvKeyValuePairs[0]?.envKey && pastedEnvKeyValuePairs[0]?.envValue
      )
    ) {
      return;
    }

    event.preventDefault();
    const envKeysBeforePastingInput = envKeys.slice(
      0,
      pastingInputIndex.current,
    );

    const envKeysAfterPastingInput = envKeys.slice(
      pastingInputIndex.current + 1,
    );
    setEnvKeys([
      ...envKeysBeforePastingInput,
      ...pastedEnvKeyValuePairs,
      ...envKeysAfterPastingInput,
    ]);
  };

  const onSubmit = async (data: any) => {
    try {
      console.log("data", data);

      const secretsToSave = data.secrets.map((secret: EnvSecret) => {
        return {
          id: secret?.id || null,
          encryptedKey: secret.encryptedKey,
          encryptedValue: secret.encryptedValue,
          branchId,
        };
      });

      await saveSecretsMutation.mutateAsync({ secrets: secretsToSave });
    } catch (err) {}
  };

  return (
    <>
      {secrets.length > 0 ? (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full">
          <div className="w-full py-8">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="mt-2 grid grid-cols-12 items-center gap-5 space-x-3"
              >
                <div className="col-span-3">
                  <Controller
                    control={control}
                    name={`secrets.${index}.decryptedKey` as const}
                    render={({ field: { value, onChange } }) => (
                      <CustomInput
                        onFocus={() => (pastingInputIndex.current = index)}
                        type="text"
                        className="my-1 w-full font-mono"
                        onPaste={handlePaste}
                        placeholder="eg. CLIENT_ID"
                        value={value}
                        onChange={async (e) => {
                          onChange(e.target.value);

                          const encryptedSecretKey = await encryptString(
                            e.target.value,
                            decryptedProjectKey,
                          );

                          setValue(
                            `secrets.${index}.encryptedKey`,
                            encryptedSecretKey,
                          );
                        }}
                      />
                    )}
                  />
                </div>

                <div className="col-span-9">
                  <div className="flex items-center gap-3">
                    <Controller
                      control={control}
                      name={`secrets.${index}.decryptedValue` as const}
                      render={({ field: { onChange, value, name } }) => (
                        <TextareaGroup
                          full
                          icon={<Eye className="text-lighter h-4 w-4" />}
                          autoComplete="off"
                          className={clsx(
                            // envPair.hidden ? "obscure" : "",
                            "inline-block font-mono",
                          )}
                          disabled={false}
                          iconActionClick={() =>
                            handleToggleHiddenEnvPairClick(index)
                          }
                          name={name}
                          value={value}
                          onChange={async (e) => {
                            onChange(e.target.value);

                            const encryptedSecretValue = await encryptString(
                              e.target.value,
                              decryptedProjectKey,
                            );

                            setValue(
                              `secrets.${index}.encryptedValue`,
                              encryptedSecretValue,
                            );
                          }}
                        />
                      )}
                    />

                    <MinusCircle
                      className="text-light hover:text-lighter h-5 w-5 shrink-0 cursor-pointer"
                      onClick={() => remove(index)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="float-right mt-4 inline-flex gap-3 ">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleAddMoreEnvClick()}
              >
                Add more
              </Button>
              <Button>Save changes</Button>
            </div>
          </div>
        </form>
      ) : (
        <Container
          className={clsx(
            isDragActive ? "border-teal-300" : "border-darker",
            "mt-10 w-full border-2 transition duration-300",
          )}
        >
          <div {...getRootProps()} className="py-32 text-center">
            <DragDropIcon className="mx-auto h-12 w-12" />
            <h3 className="mt-2 text-xl">Drag and drop .env files</h3>
            <input
              {...getInputProps()}
              type="file"
              className="hidden"
              accept="env"
            />
            <p className="text-lighter mx-auto mt-1 max-w-md text-sm">
              You can also{" "}
              <span
                onClick={open}
                className="text-teal-300 transition duration-300 hover:cursor-pointer hover:underline"
              >
                click here
              </span>{" "}
              to import, copy/paste contents in .env file, or create{" "}
              <span
                onClick={handleAddMoreEnvClick}
                className="text-teal-300 transition duration-300 hover:cursor-pointer hover:underline"
              >
                one at a time.
              </span>
            </p>
          </div>
        </Container>
      )}
    </>
  );
}

interface CustomInputProps extends ComponentProps<"input"> {
  reveal?: boolean;
}

const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
  function CustomInput({ className, disabled, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref as MutableRefObject<HTMLInputElement>}
        disabled={disabled}
        className={clsx(
          "input-primary",
          className,
          disabled ? "cursor-not-allowed" : "",
        )}
      />
    );
  },
);
