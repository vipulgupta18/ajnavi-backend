import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "varchar", length: 80 }) roomId: string;
  @Column({ type: "simple-array", default: "" }) sharedInterests: string[];
  @CreateDateColumn() startedAt: Date;
  @Column({ type: "timestamptz", nullable: true }) endedAt: Date | null;
}
