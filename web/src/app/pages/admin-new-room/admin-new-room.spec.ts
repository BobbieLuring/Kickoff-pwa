import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminNewRoom } from './admin-new-room';

describe('AdminNewRoom', () => {
  let component: AdminNewRoom;
  let fixture: ComponentFixture<AdminNewRoom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNewRoom],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNewRoom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
